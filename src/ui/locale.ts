import type { ILocaleOverride, IWeekStartOption } from "obsidian-calendar-ui";
import type { WeekSpec } from "moment";

const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const defaults = new Map<string, WeekSpec>();

export function localeWeekSpec(): WeekSpec {
  return defaults.get(window.moment.locale()) || {
    dow: window.moment.localeData().firstDayOfWeek(),
    doy: window.moment.localeData().firstDayOfYear(),
  };
}

/** Configure this fork without using Calendar's shared _bundledLocaleWeekSpec cache. */
export function configureCalendarLocale(locale: ILocaleOverride, weekStart: IWeekStartOption): void {
  const moment = window.moment;
  const requested = locale === "system-default" ? navigator.language.toLowerCase() : locale;
  const name = moment.locale(requested);
  if (!defaults.has(name)) {
    defaults.set(name, {
      dow: moment.localeData().firstDayOfWeek(),
      doy: moment.localeData().firstDayOfYear(),
    });
  }
  const original = defaults.get(name);
  const configured = weekStart === "locale" ? original : { ...original, dow: weekdays.indexOf(weekStart) };
  moment.updateLocale(name, { week: configured });
}
