# Startup Panel Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm công tắc lưu được để bật/tắt tự mở panel, giữ nguyên mở thủ công.

**Architecture:** Bổ sung `openOnStartup` vào hệ thống settings/store hiện có.
Chỉ kiểm tra tùy chọn tại callback `onLayoutReady`, sau khi `loadOptions()` hoàn
tất; giữ `initLeaf()` dùng chung cho các command. Dùng `Setting.addToggle` hiện
có để lưu qua `writeOptions()`.

**Tech Stack:** TypeScript 4.9, Obsidian API, Svelte store, Jest 26/ts-jest, Rollup.

**Spec:** [2026-10-27-startup-panel.md](../specs/2026-10-27-startup-panel.md)

## Global Constraints

- Giữ `calendar-deadlines`, phiên bản `1.0.0`, `minAppVersion: 1.0.0`.
- Không thêm dependency, không thay đổi CSS hoặc logic deadline.
- Không commit, push, publish, deploy hay ghi vào vault nếu chưa được yêu cầu.
- Kiểm thử tự động với mock Obsidian không thay thế kiểm tra workspace thực tế.

## Review Focus

1. Cấu hình cũ thiếu khóa mới: mặc định ON; `false` đã lưu không bị mặc định ghi đè.
2. OFF với workspace khôi phục panel: không gọi tạo/hiện/đóng panel.
3. OFF và người dùng mở thủ công: cả ba command vẫn hoạt động, không tạo pane trùng.
4. Gạt công tắc trước callback layout: đọc giá trị mới nhất; không mở/đóng ngay khi gạt.
5. Unload trước layout hoặc lúc đang mở: không hiện lại panel; Calendar gốc không bị đóng.

---

## Điều tra trước thay đổi

- `src/main.ts:74`: callback `onLayoutReady` hiện chỉ kiểm tra `unloading`.
- `src/main.ts:90`: `openLeaf()` tái sử dụng pane, sau đó luôn gọi `revealLeaf`.
- Ba command đều gọi `initLeaf()`: đặt chặn tại hàm dùng chung sẽ làm OFF chặn
  cả thao tác thủ công, sai yêu cầu.
- `loadOptions()` merge mặc định trước dữ liệu đã lưu: phù hợp thêm khóa boolean.
- `src/settings.ts:addShowWeeklyNoteSetting()` là mẫu toggle tương tự, nhưng
  toggle mới không cần `display()` lại vì không điều khiển nhóm trường phụ.
- `src/main.spec.ts` hiện mock `onLayoutReady` mà không gọi callback: 4 test
  hiện có không bao phủ tự mở lúc khởi động. Baseline 4/4 đã chạy thành công.
- Giả thuyết cần khóa bằng test: gate tại callback khởi động sẽ ngăn reveal khi
  OFF mà không ảnh hưởng các lệnh thủ công và guard unload hiện có.

## File structure

| File | Trách nhiệm |
| --- | --- |
| `src/settings.ts` | Kiểu, mặc định, toggle trong General Settings |
| `src/main.ts` | Điều kiện tự mở khi layout sẵn sàng |
| `src/main.spec.ts` | Lifecycle, lưu cấu hình, lệnh thủ công và race unload |
| `src/settings.spec.ts` (mới) | Toggle nhận giá trị đúng và ghi ON/OFF |
| `README.md` | Mô tả mặc định và khác biệt với workspace restore |

### Task 1: Tùy chọn lưu được và luồng khởi động

**Files:** Modify `src/settings.ts`, `src/main.ts:74`, `src/main.spec.ts`; create `src/settings.spec.ts`; update `README.md`.

**Interfaces:**
- Consumes: `loadOptions(): Promise<void>`, `writeOptions(changeOpts: (settings: ISettings) => Partial<ISettings>): Promise<void>`, `initLeaf(): Promise<CalendarView | null>`.
- Produces: `ISettings.openOnStartup: boolean`, `defaultSettings.openOnStartup = true`, `CalendarDeadlinesSettingsTab.addOpenOnStartupSetting(): void`.
- Không thêm tham số hoặc sửa ý nghĩa `initLeaf()`.

- [x] **Step 1: Viết test lifecycle trước khi sửa production code.**

  Cập nhật default settings mock với khóa mới. Trong từng test, lấy callback từ
  `app.workspace.onLayoutReady.mock.calls[0][0]`; spy `initLeaf` và await promise
  nó trả về khi callback gọi. Không dùng timeout tùy ý.

  | Test | Assertions bắt buộc |
  | --- | --- |
  | `defaults old configurations to startup ON` | `loadData` trả `{}`; `options.openOnStartup === true`; callback gọi `initLeaf` và `revealLeaf` đúng 1 lần |
  | `preserves saved startup OFF` | `loadData` trả `{openOnStartup:false}`; options và lần `saveData` sau load đều giữ `false` |
  | `does not create or reveal panes at startup when OFF` | Callback không gọi `initLeaf`, `getRightLeaf`, `setViewState`, `revealLeaf` |
  | `leaves restored panes untouched when OFF` | Tạo pane bằng mở thủ công, clear mock; callback OFF không gọi `revealLeaf` hoặc `detach`, view vẫn còn |
  | `uses the latest option when layout becomes ready` | ON→OFF bằng `writeOptions` trước callback: không mở; OFF→ON: mở đúng 1 lần |
  | `keeps manual commands available when OFF` | Cả `show-calendar-view`, `open-weekly-note`, `reveal-active-note` mở/hiện pane; weekly/reveal nhận đúng đối số; tái sử dụng cùng pane |
  | `does not open after unloading before layout is ready` | `onunload()` rồi callback: không tạo hoặc reveal pane |

- [x] **Step 2: Chạy `npm test -- --runInBand src/main.spec.ts`.**

  Mong đợi test mới thất bại ở khóa chưa tồn tại hoặc startup OFF vẫn gọi
  `initLeaf`; ghi nhận nguyên nhân trước khi sửa, không coi lỗi setup là RED hợp lệ.

- [x] **Step 3: Thêm settings và gate startup tối thiểu.**

  Trong `src/settings.ts`, thêm thuộc tính `openOnStartup: boolean` vào
  `ISettings` và `openOnStartup: true` vào mặc định. Trong callback layout của
  `src/main.ts`, kiểm tra cả `!this.unloading` và `this.options.openOnStartup`
  trước khi gọi `initLeaf`. Giữ nguyên merge defaults→saved trong `loadOptions`.

- [x] **Step 4: Chạy lại test lifecycle.**

  `npm test -- --runInBand src/main.spec.ts` phải PASS, gồm cả 4 test hiện có
  về coexistence, reopen command, concurrent opens và unload trong lúc mở.

- [x] **Step 5: Viết test toggle với mock Obsidian `Setting` trong `src/settings.spec.ts`.**

  Mock `PluginSettingTab` và chain `setName`, `setDesc`, `addToggle`. Capture
  `setValue`/`onChange` của toggle, gọi method thật `addOpenOnStartupSetting()`.
  Dùng options từ `getDefaultSettings()`; mock `writeOptions` áp dụng callback
  vào options và trả Promise. Các assertion sau phải được kiểm tra:

  ```ts
  expect(label).toBe("Open panel on startup");
  expect(setValue).toHaveBeenCalledWith(false); // fixture lưu OFF
  await onChange(true);
  expect(plugin.options.openOnStartup).toBe(true);
  await onChange(false);
  expect(plugin.options.openOnStartup).toBe(false);
  ```

  Thêm fixture ON để kiểm tra `setValue(true)`; các callback không được gọi
  `initLeaf` hoặc đóng pane. Test `writeOptions` trong `src/main.spec.ts` phải
  xác nhận `saveData` nhận lần lượt ON rồi OFF và giữ nguyên các trường khác.
  Thêm test `display registers startup toggle after week numbers`: stub các
  method settings khác và API container Obsidian, gọi `display()` thật; so sánh
  `mock.invocationCallOrder` để xác nhận method mới được gọi sau
  `addShowWeeklyNoteSetting()` đúng một lần, không chỉ tồn tại mà bị quên gắn UI.

- [x] **Step 6: Chạy test toggle để xác nhận RED.**

  `npm test -- --runInBand src/settings.spec.ts` phải fail vì method mới chưa
  được định nghĩa; không được fail vì thiếu mock Obsidian hoặc Svelte store.

- [x] **Step 7: Triển khai `addOpenOnStartupSetting(): void`.**

  Dùng nhãn/mô tả chính xác trong spec, `setValue(this.plugin.options.openOnStartup)`
  và `toggle.onChange(async value => { await this.plugin.writeOptions(() => ({ openOnStartup: value })); })`.
  Gọi method trong `display()` ngay sau `addShowWeeklyNoteSetting()`.
  Không gọi `initLeaf`, `detach`, hoặc render lại tab ở callback toggle.

- [x] **Step 8: Cập nhật README mục cấu hình.**

  Nêu mặc định ON, vị trí công tắc, lưu qua lần nạp sau, mở thủ công luôn được
  và OFF không ngăn Obsidian tự khôi phục workspace. Không hứa tự thu sidebar.

- [x] **Step 9: Chạy toàn bộ kiểm tra theo README.**

  ```sh
  npm run typecheck
  npm test -- --runInBand
  npm run build
  git diff --check
  ```

  Mong đợi: mọi lệnh exit 0; Svelte/lint không lỗi; không có test hồi quy fail.
  Các cảnh báo dependency có sẵn cần phân biệt với lỗi do thay đổi.

- [x] **Step 10: Review diff và kiểm tra Obsidian nếu có môi trường thực tế.**

  Kiểm tra công tắc nằm đúng vị trí; OFF→khởi động lại không bị plugin bung
  sidebar; ON→khởi động lại hiện panel; tắt/bật plugin; Open view khi OFF;
  workspace có panel đã lưu không bị plugin đóng. Nếu chưa kiểm tra trong
  Obsidian, báo rõ giới hạn, không tuyên bố kiểm chứng thực tế. Không commit.

## Self-review

- Yêu cầu ON/OFF, lưu cài đặt, startup gate, UI và tài liệu cùng một task độc lập.
- Năm mục Review Focus đều có test lifecycle/toggle tương ứng.
- Mọi nơi dùng thống nhất `openOnStartup`; không gate command thủ công.
- Người dùng đã duyệt và chọn thực hiện trực tiếp; production code và test đã hoàn thành.

## Kết quả thực thi

- Tái hiện RED: 4 test lifecycle thất bại vì OFF vẫn gọi mở panel. Đã thêm
  khai báo kiểu boolean trước lần chạy RED hợp lệ để không nhầm lỗi compile
  với lỗi hành vi; chưa thay đổi hành vi ở bước khai báo kiểu.
- Thêm mặc định ON và gate tại callback startup: 12 test lifecycle đạt.
- Tái hiện RED của UI: 4 test thất bại vì thiếu method/toggle trong display;
  sau khi triển khai, test toggle và vị trí cài đặt đều đạt.
- Bổ sung test plugin được bật sau khi layout đã sẵn sàng (ON/OFF) và tái sử
  dụng pane đã khôi phục khi ON.
- `npm run typecheck`: PASS.
- `npm test -- --runInBand`: PASS, 74 test / 12 suite.
- `npm run build`: PASS; Svelte check 0 errors, 0 warnings, 0 hints; lint PASS.
- `git diff --check`: PASS.
- Các deprecation warning Node/ts-jest đã có ở baseline, không phải lỗi mới.
- Đã tự review diff. Chưa kiểm chứng trực tiếp trong Obsidian; không commit,
  publish hoặc ghi vào vault.
