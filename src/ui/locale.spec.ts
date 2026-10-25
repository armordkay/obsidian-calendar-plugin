import moment from "moment";
import "moment/locale/en-gb";
import { configureCalendarLocale, localeWeekSpec } from "./locale";

beforeEach(() => Object.assign(window, { moment }));
afterEach(() => {
  moment.updateLocale("en-gb", { week: { dow: 1, doy: 4 } });
  moment.updateLocale("en", { week: { dow: 0, doy: 6 } });
  moment.locale("en");
});

it("restores each locale's own week start after an override", () => {
  configureCalendarLocale("en-gb", "sunday");
  expect(moment.localeData().firstDayOfWeek()).toBe(0);
  expect(localeWeekSpec().dow).toBe(1);
  configureCalendarLocale("en", "monday");
  expect(moment.localeData().firstDayOfWeek()).toBe(1);
  expect(localeWeekSpec().dow).toBe(0);
  configureCalendarLocale("en-gb", "locale");
  expect(moment.localeData().firstDayOfWeek()).toBe(1);
  configureCalendarLocale("en", "locale");
  expect(moment.localeData().firstDayOfWeek()).toBe(0);
});
