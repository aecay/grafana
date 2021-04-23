package alerting

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

//{
//"receiver": "email_recv",
//"group_by": [
//"alertname"
//],
//"matchers": [
//"alertname=\"EmailAlert\""
//]
//},

const totalReceivers = 4
const alertmanagerConfig = `
{
  "alertmanager_config": {
    "route": {
      "receiver": "slack_recv1",
      "group_by": [
        "alertname"
      ],
      "routes": [
        {
          "receiver": "slack_recv1",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"SlackAlert1\""
          ]
        },
        {
          "receiver": "slack_recv2",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"SlackAlert2\""
          ]
        },
        {
          "receiver": "pagerduty_recv",
          "group_by": [
            "alertname"
          ],
          "matchers": [
            "alertname=\"PagerdutyAlert\""
          ]
        }
      ]
    },
    "receivers": [
      {
        "name": "email_recv",
        "grafana_managed_receiver_configs": [
          {
            "name": "email_test",
            "type": "email",
            "settings": {
              "addresses": "test@email.com",
              "singleEmail": true
            }
          }
        ]
      },
      {
        "name": "slack_recv1",
        "grafana_managed_receiver_configs": [
          {
            "name": "slack_test_without_token",
            "type": "slack",
            "settings": {
              "recipient": "#test-channel",
              "url": "http://CHANNEL_ADDR/slack_recv1/slack_test_without_token",
              "mentionChannel": "here",
              "mentionUsers": "user1, user2",
              "mentionGroups": "group1, group2",
              "username": "Integration Test",
              "icon_emoji": "🚀",
              "icon_url": "https://awesomeemoji.com/rocket",
              "text": "Integration Test {{ template \"slack.default.text\" . }}",
              "title": "Integration Test {{ template \"slack.default.title\" . }}",
              "fallback": "Integration Test {{ template \"slack.default.title\" . }}"
            }
          }
        ]
      },
      {
        "name": "slack_recv2",
        "grafana_managed_receiver_configs": [
          {
            "name": "slack_test_with_token",
            "type": "slack",
            "settings": {
              "recipient": "#test-channel",
              "token": "myfullysecrettoken",
              "mentionUsers": "user1, user2",
              "username": "Integration Test"
            }
          }
        ]
      },
      {
        "name": "pagerduty_recv",
        "grafana_managed_receiver_configs": [
          {
            "name": "pagerduty_test",
            "type": "pagerduty",
            "settings": {
              "integrationKey": "pagerduty_recv/pagerduty_test",
              "severity": "warning",
              "class": "testclass",
              "component": "Integration Test",
              "group": "testgroup",
              "summary": "Integration Test {{ template \"pagerduty.default.description\" . }}"
            }
          }
        ]
      }
    ]
  }
}

`

func getAlertmanagerConfig(channelAddr string) string {
	return strings.ReplaceAll(alertmanagerConfig, "CHANNEL_ADDR", channelAddr)
}

func getRulesConfig(t *testing.T) io.Reader {
	interval, err := model.ParseDuration("10s")
	require.NoError(t, err)
	rules := apimodels.PostableRuleGroupConfig{
		Name:     "arulegroup",
		Interval: interval,
	}

	// Create rules that will fire as quickly as possible for all the routes.
	alertNames := []string{"EmailAlert", "SlackAlert1", "SlackAlert2", "PagerdutyAlert"}
	//alertNames := []string{"PagerdutyAlert"}
	for _, alertName := range alertNames {
		rules.Rules = append(rules.Rules, apimodels.PostableExtendedRuleNode{
			GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
				Title:     alertName,
				Condition: "A",
				Data: []ngmodels.AlertQuery{
					{
						RefID: "A",
						RelativeTimeRange: ngmodels.RelativeTimeRange{
							From: ngmodels.Duration(time.Duration(5) * time.Hour),
							To:   ngmodels.Duration(time.Duration(3) * time.Hour),
						},
						DatasourceUID: "-100",
						Model: json.RawMessage(`{
							"type": "math",
							"expression": "2 + 3 > 1"
						}`),
					},
				},
			},
		})
	}

	buf := bytes.Buffer{}
	enc := json.NewEncoder(&buf)
	err = enc.Encode(&rules)
	require.NoError(t, err)

	return &buf
}

func TestNotificationChannels(t *testing.T) {
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{"ngalert"},
		AnonymousUserRole:    models.ROLE_EDITOR,
	})

	store := testinfra.SetUpDatabase(t, dir)
	grafanaListedAddr := testinfra.StartGrafana(t, dir, path, store)

	mockChannel := newMockNotificationChannel(t, grafanaListedAddr)
	amConfig := getAlertmanagerConfig(mockChannel.server.Addr)
	rulesConfig := getRulesConfig(t)

	channels.SlackAPIEndpoint = fmt.Sprintf("http://%s/slack_recvX/slack_testX", mockChannel.server.Addr)
	channels.PagerdutyEventAPIURL = fmt.Sprintf("http://%s/pagerduty_recvX/pagerduty_testX", mockChannel.server.Addr)

	// There are no notification channel config initially.
	{
		alertsURL := fmt.Sprintf("http://%s/api/alertmanager/grafana/config/api/v1/alerts", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(alertsURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	}

	// Now, let's test the endpoint with some alerts.
	{
		// Create the namespace we'll save our alerts to.
		require.NoError(t, createFolder(t, store, 0, "default"))
	}

	{
		buf := bytes.NewReader([]byte(amConfig))
		u := fmt.Sprintf("http://%s/api/alertmanager/grafana/config/api/v1/alerts", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Post(u, "application/json", buf)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		require.NoError(t, err)
		require.Equal(t, 202, resp.StatusCode)
	}

	{
		alertsURL := fmt.Sprintf("http://%s/api/alertmanager/grafana/config/api/v1/alerts", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Get(alertsURL)
		require.NoError(t, err)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		cfg := apimodels.GettableUserConfig{}
		require.NoError(t, json.Unmarshal(b, &cfg))

		require.Equal(t, totalReceivers, len(cfg.AlertmanagerConfig.Receivers))
	}

	// Create rules that will fire as quickly as possible
	{
		u := fmt.Sprintf("http://%s/api/ruler/grafana/api/v1/rules/default", grafanaListedAddr)
		// nolint:gosec
		resp, err := http.Post(u, "application/json", rulesConfig)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		require.NoError(t, err)

		require.Equal(t, 202, resp.StatusCode)
	}

	// Eventually, we'll get an alert with its state being active.
	{
		alertsURL := fmt.Sprintf("http://%s/api/alertmanager/grafana/api/v2/alerts", grafanaListedAddr)
		// nolint:gosec
		require.Eventually(t, func() bool {
			resp, err := http.Get(alertsURL)
			require.NoError(t, err)
			t.Cleanup(func() {
				err := resp.Body.Close()
				require.NoError(t, err)
			})
			b, err := ioutil.ReadAll(resp.Body)
			require.NoError(t, err)
			require.Equal(t, 200, resp.StatusCode)

			var alerts apimodels.GettableAlerts
			err = json.Unmarshal(b, &alerts)
			require.NoError(t, err)

			//if len(alerts) > 0 {
			//	status := alerts[0].Status
			//	return status != nil && status.State != nil && *status.State == "active"
			//}

			fmt.Println(mockChannel.totalNotifications(), alerts)
			return len(alerts) >= 4 && mockChannel.totalNotifications() >= 4
		}, 180*time.Second, 2*time.Second)
	}

	require.NoError(t, mockChannel.Close())
}

type mockNotificationChannel struct {
	t      *testing.T
	server *http.Server

	receivedNotifications    map[string][]string
	receivedNotificationsMtx sync.Mutex
}

func newMockNotificationChannel(t *testing.T, grafanaListedAddr string) *mockNotificationChannel {
	lastDigit := grafanaListedAddr[len(grafanaListedAddr)-1] - 48
	lastDigit = (lastDigit + 1) % 10
	newAddr := fmt.Sprintf("%s%01d", grafanaListedAddr[:len(grafanaListedAddr)-1], lastDigit)

	nc := &mockNotificationChannel{
		server: &http.Server{
			Addr: newAddr,
		},
		receivedNotifications: make(map[string][]string),
		t:                     t,
	}

	nc.server.Handler = nc
	go func() {
		require.Equal(t, http.ErrServerClosed, nc.server.ListenAndServe())
	}()

	return nc
}

func (nc *mockNotificationChannel) ServeHTTP(res http.ResponseWriter, req *http.Request) {
	fmt.Println("MOCK", req.URL.String())
	parts := strings.Split(req.URL.String(), "/")
	key := fmt.Sprintf("%s/%s", parts[len(parts)-2], parts[len(parts)-1])
	nc.receivedNotifications[key] = append(nc.receivedNotifications[key], getBody(nc.t, req.Body))
	res.WriteHeader(http.StatusOK)
}

func getBody(t *testing.T, body io.ReadCloser) string {
	b, err := ioutil.ReadAll(body)
	require.NoError(t, err)
	return string(b)
}

func (nc *mockNotificationChannel) totalNotifications() int {
	total := 0
	nc.receivedNotificationsMtx.Lock()
	defer nc.receivedNotificationsMtx.Unlock()
	for _, v := range nc.receivedNotifications {
		total += len(v)
	}
	return total
}

func (nc *mockNotificationChannel) Close() error {
	return nc.server.Close()
}
