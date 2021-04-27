import { CombinedRule, RulesSource } from 'app/types/unified-alerting';
import React, { FC, useMemo } from 'react';
import { useStyles } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { isAlertingRule, isGrafanaRulerRule } from '../../utils/rules';
import { isCloudRulesSource, isGrafanaRulesSource } from '../../utils/datasource';
import { Annotation } from '../Annotation';
import { AlertLabels } from '../AlertLabels';
import { AlertInstancesTable } from './AlertInstancesTable';
import { DetailsField } from '../DetailsField';
import { RuleQuery } from './RuleQuery';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { ExpressionDatasourceUID } from 'app/features/expressions/ExpressionDatasource';

interface Props {
  rule: CombinedRule;
  rulesSource: RulesSource;
}

export const RuleDetails: FC<Props> = ({ rule, rulesSource }) => {
  const styles = useStyles(getStyles);

  const { promRule } = rule;

  const annotations = Object.entries(rule.annotations);

  const dataSources: Array<{ name: string; icon?: string }> = useMemo(() => {
    if (isCloudRulesSource(rulesSource)) {
      return [{ name: rulesSource.name, icon: rulesSource.meta.info.logos.small }];
    }

    if (isGrafanaRulerRule(rule.rulerRule)) {
      const { data } = rule.rulerRule.grafana_alert;

      if (!Array.isArray(data)) {
        return [];
      }

      return data.reduce((dataSources, query) => {
        const ds = getDatasourceSrv().getInstanceSettings(query.datasourceUid);

        if (!ds || ds.uid === ExpressionDatasourceUID) {
          return dataSources;
        }

        dataSources.push({ name: ds.name, icon: ds.meta.info.logos.small });
        return dataSources;
      }, [] as Array<{ name: string; icon?: string }>);
    }

    return [];
  }, [rule, rulesSource]);

  return (
    <div>
      <div className={styles.wrapper}>
        <div className={styles.leftSide}>
          {!!rule.labels && !!Object.keys(rule.labels).length && (
            <DetailsField label="Labels" horizontal={true}>
              <AlertLabels labels={rule.labels} />
            </DetailsField>
          )}
          <DetailsField
            label={isGrafanaRulesSource(rulesSource) ? 'Query' : 'Expression'}
            className={cx({ [styles.exprRow]: !!annotations.length })}
            horizontal={true}
          >
            <RuleQuery rule={rule} rulesSource={rulesSource} />
          </DetailsField>
          {annotations.map(([key, value]) => (
            <DetailsField key={key} label={key} horizontal={true}>
              <Annotation annotationKey={key} value={value} />
            </DetailsField>
          ))}
        </div>
        <div className={styles.rightSide}>
          {!!dataSources.length && (
            <DetailsField label="Data source">
              {dataSources.map(({ name, icon }) => (
                <div key={name}>
                  {icon && (
                    <>
                      <img className={styles.dataSourceIcon} src={icon} />{' '}
                    </>
                  )}
                  {name}
                </div>
              ))}
            </DetailsField>
          )}
        </div>
      </div>
      {promRule && isAlertingRule(promRule) && !!promRule.alerts?.length && (
        <DetailsField label="Matching instances" horizontal={true}>
          <AlertInstancesTable instances={promRule.alerts} />
        </DetailsField>
      )}
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme) => ({
  wrapper: css`
    display: flex;
    flex-direction: row;
  `,
  leftSide: css`
    flex: 1;
  `,
  rightSide: css`
    padding-left: 90px;
    width: 300px;
  `,
  exprRow: css`
    margin-bottom: 46px;
  `,
  dataSourceIcon: css`
    width: ${theme.spacing.md};
    height: ${theme.spacing.md};
  `,
});
