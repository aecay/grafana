import {
  AnnotationQuery,
  BusEventBase,
  BusEventWithPayload,
  eventFactory,
  GrafanaThemeV2,
  TimeRange,
} from '@grafana/data';
import { IconName } from '@grafana/ui';

/**
 * Event Payloads
 */

export interface ShowDashSearchPayload {
  query?: string;
}

export interface LocationChangePayload {
  href: string;
}

export interface ShowModalPayload {
  model?: any;
  modalClass?: string;
  src?: string;
  templateHtml?: string;
  backdrop?: any;
  scope?: any;
}

export interface ShowModalReactPayload {
  component: React.ComponentType<any>;
  props?: any;
}

export interface ShowConfirmModalPayload {
  title?: string;
  text?: string;
  text2?: string;
  text2htmlBind?: boolean;
  confirmText?: string;
  altActionText?: string;
  yesText?: string;
  noText?: string;
  icon?: IconName;

  onConfirm?: () => void;
  onAltAction?: () => void;
}

export interface DataSourceResponse<T> {
  data: T;
  readonly status: number;
  readonly statusText: string;
  readonly ok: boolean;
  readonly headers: Headers;
  readonly redirected: boolean;
  readonly type: ResponseType;
  readonly url: string;
  readonly config: any;
}

type DataSourceResponsePayload = DataSourceResponse<any>;

export interface ToggleKioskModePayload {
  exit?: boolean;
}

export interface GraphClickedPayload {
  pos: any;
  panel: any;
  item: any;
}

export interface ThresholdChangedPayload {
  threshold: any;
  handleIndex: any;
}

export interface DashScrollPayload {
  restore?: boolean;
  animate?: boolean;
  pos?: number;
}

export interface PanelChangeViewPayload {}

/**
 * Events
 */

export const dashLinksUpdated = eventFactory('dash-links-updated');
export const searchQuery = eventFactory('search-query');

export const dsRequestResponse = eventFactory<DataSourceResponsePayload>('ds-request-response');
export const dsRequestError = eventFactory<any>('ds-request-error');

export const toggleSidemenuMobile = eventFactory('toggle-sidemenu-mobile');
export const toggleSidemenuHidden = eventFactory('toggle-sidemenu-hidden');

export const toggleKioskMode = eventFactory<ToggleKioskModePayload>('toggle-kiosk-mode');

export const timeRangeUpdated = eventFactory<TimeRange>('time-range-updated');
export const templateVariableValueUpdated = eventFactory('template-variable-value-updated');

export const graphClicked = eventFactory<GraphClickedPayload>('graph-click');

export const thresholdChanged = eventFactory<ThresholdChangedPayload>('threshold-changed');

export const zoomOut = eventFactory<number>('zoom-out');

export const shiftTime = eventFactory<number>('shift-time');

export const routeUpdated = eventFactory('$routeUpdate');

/**
 * Used for syncing queries badge count in panel edit queries tab
 * Think we can get rid of this soon
 */
export class PanelQueriesChangedEvent extends BusEventBase {
  static type = 'panel-queries-changed';
}

/**
 * Used for syncing transformations badge count in panel edit transform tab
 * Think we can get rid of this soon
 */
export class PanelTransformationsChangedEvent extends BusEventBase {
  static type = 'panel-transformations-changed';
}

/**
 * Used by panel editor to know when panel plugin it'self trigger option updates
 */
export class PanelOptionsChangedEvent extends BusEventBase {
  static type = 'panels-options-changed';
}

/**
 * Used internally by DashboardModel to commmunicate with DashboardGrid that it needs to re-render
 */
export class DashboardPanelsChangedEvent extends BusEventBase {
  static type = 'dashboard-panels-changed';
}

export class RefreshEvent extends BusEventBase {
  static type = 'refresh';
}

export class RenderEvent extends BusEventBase {
  static type = 'render';
}

export class ThemeChangedEvent extends BusEventWithPayload<GrafanaThemeV2> {
  static type = 'theme-changed';
}

export class ZoomOutEvent extends BusEventWithPayload<number> {
  static type = 'zoom-out';
}

export enum ShiftTimeEventPayload {
  Left = -1,
  Right = 1,
}
export class ShiftTimeEvent extends BusEventWithPayload<ShiftTimeEventPayload> {
  static type = 'shift-time';
}

export class RemovePanelEvent extends BusEventWithPayload<number> {
  static type = 'remove-panel';
}

export class ShowModalEvent extends BusEventWithPayload<ShowModalPayload> {
  static type = 'show-modal';
}

export class ShowConfirmModalEvent extends BusEventWithPayload<ShowConfirmModalPayload> {
  static type = 'show-confirm-modal';
}

export class ShowModalReactEvent extends BusEventWithPayload<ShowModalReactPayload> {
  static type = 'show-react-modal';
}

export class HideModalEvent extends BusEventBase {
  static type = 'hide-modal';
}

export class DashboardSavedEvent extends BusEventBase {
  static type = 'dashboard-saved';
}

export class AnnotationQueryStarted extends BusEventWithPayload<AnnotationQuery> {
  static type = 'annotation-query-started';
}

export class AnnotationQueryFinished extends BusEventWithPayload<AnnotationQuery> {
  static type = 'annotation-query-finished';
}
