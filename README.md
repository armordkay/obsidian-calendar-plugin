# Calendar Deadlines

Plugin Obsidian kết hợp lịch ghi chú ngày/tuần với timeline deadline có thể cuộn.
Plugin được phát triển độc lập dưới ID **`calendar-deadlines`**, dựa trên
[Calendar của Liam Cain](https://github.com/liamcain/obsidian-calendar-plugin).

## Tính năng

- Mở hoặc tạo Daily Note bằng cách chọn ngày; hỗ trợ template và xác nhận trước khi tạo.
- Mở Weekly Note từ số tuần hoặc Command Palette.
- Đọc task Markdown chưa hoàn thành trong **toàn bộ vault**, không giới hạn ở Daily Notes.
- Hiển thị tất cả deadline theo ngày và giờ trong một timeline liên tục, xuyên tháng/năm.
- Chọn ngày trên lịch để cuộn tới ngày đó trong timeline; chọn ngày trong timeline để đổi tháng trên lịch.
- Bấm icon hoặc tên công việc để mở ghi chú tại dòng chứa task.
- Tự cập nhật khi sửa, hoàn thành, xóa, đổi tên hoặc di chuyển ghi chú.
- Đánh dấu deadline quá hạn theo ngày hoặc giờ bằng màu đỏ.
- Không cần cài Dataview, Tasks hay Taskido để sử dụng timeline.

## Cài đặt thủ công

Yêu cầu tối thiểu được khai báo: **Obsidian 1.0.0**. Khả năng chạy trên từng
phiên bản Obsidian và trên thiết bị di động cần được kiểm tra thực tế.

1. Lấy `main.js`, `manifest.json` và `styles.css` từ bản build hoặc bản phát hành của fork này.
2. Tạo thư mục `<vault>/.obsidian/plugins/calendar-deadlines/`.
3. Chép cả ba file vào thư mục đó.
4. Tải lại Obsidian, bật **Calendar Deadlines** trong Community plugins.

Khi cập nhật, thay cả ba file rồi tắt/bật lại plugin. Giữ `data.json` nếu muốn
giữ cấu hình. Không cài fork vào thư mục `calendar` của plugin gốc.

Plugin có view type riêng `calendar-deadlines-view`, nên không dùng chung panel
với Calendar gốc. Nếu nâng cấp từ bản fork cũ từng dùng view type `calendar`,
hãy đóng panel cũ và chạy **Calendar Deadlines: Open view**. Plugin không tự sửa
panel hoặc dữ liệu cấu hình của Calendar gốc.

## Viết deadline

Trong bất kỳ file Markdown nào trong vault:

```md
- [ ] Nộp báo cáo 📅 2026-10-25 ⏰ 2026-10-25 14:30
- [ ] Họp nhóm [due:: 2026-10-25T09:00]
- [ ] Review tài liệu [due:: 2026-10-25] [time:: 16:00]
- [ ] Gọi điện (@2026-10-25 10:00)
- [ ] 08:30 Chuẩn bị bài 📅 2026-10-26
- [ ] Công việc cả ngày 📅 2026-10-27
```

- Ngày dùng `YYYY-MM-DD`, giờ dùng `HH:mm` trong múi giờ địa phương của thiết bị.
- Hỗ trợ task `- [ ]`, `* [ ]`, `+ [ ]`, danh sách đánh số và task trong blockquote được Obsidian nhận diện.
- Chỉ checkbox trống `[ ]` được xem là chưa hoàn thành. `[x]`, `[-]` và các trạng thái tùy chỉnh khác không xuất hiện.
- Nếu có cả due date và reminder, due date quyết định ngày deadline. Giờ reminder chỉ được dùng khi cùng ngày với due date.
- Không có giờ: hiển thị **All day**, quá hạn khi sang ngày tiếp theo.
- Có giờ: quá hạn khi đồng hồ đã qua phút đó. Trạng thái cập nhật khoảng mỗi phút khi view đang mở.
- Ngày hoặc giờ ghi sai sẽ không được đưa vào timeline; không tự biến giờ sai thành deadline cả ngày.
- Chưa hỗ trợ time range, giây, timezone offset, natural language, hoặc suy ra deadline từ tên file.
- Task mẫu trong code block không được tính. Nội dung lấy từ metadata Markdown, không thực thi DataviewJS.

Timeline sắp xếp ngày tăng dần, trong ngày sắp xếp giờ tăng dần, rồi đến task cả ngày.
Chọn ngày không có deadline sẽ cuộn tới ngày kế tiếp có deadline; các ngày khác
vẫn có thể xem bằng cách cuộn. Nút **Today** đưa lịch và timeline về hôm nay.

Index chỉ đọc lại ghi chú thay đổi; lần mở đầu và lúc metadata hoàn tất sẽ đối
chiếu toàn vault. Nếu một file không đọc được, deadline của các file khác vẫn
hiển thị, kèm thông báo và nút **Retry**. Timeline hiển thị đầy đủ chiều cao,
dùng thanh cuộn chung của panel Obsidian, không có thanh cuộn riêng. Hiện chưa
có virtual scrolling.

## Màu sắc và dấu chấm

| Trạng thái | Hiển thị |
| --- | --- |
| Có deadline | Light mode: nền xám dịu, chữ tối; dark mode: nền trắng, chữ tối |
| Có ít nhất một deadline quá hạn | Nền đỏ; tự cập nhật khi trễ giờ hoặc qua ngày |
| Hôm nay | Xanh da trời; nếu có deadline thì viền xanh da trời |
| Ngày đang chọn | Nền xanh lục, không viền, ưu tiên hơn deadline/quá hạn/hôm nay |
| Deadline quá hạn | Nền icon, tên và giờ màu đỏ, kể cả khi hover/chọn |
| Chấm đặc | Số từ trong Daily/Weekly Note; tối đa 5 chấm |
| Chấm rỗng | Có task chưa hoàn thành trong Daily/Weekly Note |

Chấm dùng màu tương phản với nền ô ngày, giữ chấm task rỗng. Khung lịch và
timeline được bo tròn bốn góc. Dark mode dùng nền xám tối; light mode dùng
nền sáng và màu chữ/viền tương ứng.

Giao diện **tự theo light/dark mode của Obsidian** (kể cả khi Obsidian theo hệ
điều hành), đổi ngay khi theme của ứng dụng thay đổi. Không cần tải lại plugin
hoặc bật công tắc riêng. Ngày chuyển đỏ nếu có bất kỳ task chưa hoàn thành nào
đã quá hạn; hoàn thành task đó sẽ trả về màu deadline của theme hiện tại nếu
chỉ còn deadline chưa trễ.

## Cấu hình và ghi chú định kỳ

- **Words per dot:** mặc định 250; đặt 0 để tắt chấm số từ.
- **Start week on:** ngày bắt đầu tuần hoặc theo locale.
- **Confirm before creating new note:** xác nhận trước khi tạo Daily/Weekly Note.
- **Show week number:** bật cột số tuần và cấu hình Weekly Note.
- **Open panel on startup:** mặc định bật (ON), nằm ngay dưới **Show week number**.
  Tắt (OFF) để plugin không chủ động mở/hiện panel khi vào Obsidian hoặc khi
  bật lại plugin. Lựa chọn được lưu và áp dụng ở lần nạp plugin tiếp theo;
  gạt công tắc không tự mở/đóng panel đang dùng. Cấu hình cũ chưa có tùy chọn
  này vẫn mặc định ON.
- **Override locale:** locale hiển thị lịch; khóa ngày và tính quá hạn vẫn dùng dạng số cố định.

Khi tự mở đang OFF, các lệnh **Open view**, **Open Weekly Note** và
**Reveal active note** vẫn mở panel theo yêu cầu. Obsidian vẫn có thể khôi
phục panel từ workspace đã lưu; OFF không tự đóng panel hoặc thu gọn sidebar
đã được Obsidian khôi phục.

Daily Note đọc folder, format và template từ **Daily Notes** của Obsidian hoặc
phần daily đang bật trong **Periodic Notes**. Timeline deadline hoạt động độc lập
với hai plugin đó. File có tên giống ngày nhưng ở ngoài folder Daily Note sẽ
không bị nhận nhầm là Daily Note.

Weekly Note ưu tiên phần weekly đang bật trong **Periodic Notes**. Nếu không bật,
plugin dùng `weeklyNoteFolder`, `weeklyNoteFormat`, `weeklyNoteTemplate` của chính
**Calendar Deadlines**, không đọc cấu hình Calendar gốc. Format mặc định:
`gggg-[W]ww`. Template hỗ trợ `{{title}}`, `{{date}}`, `{{time}}`, định dạng ngày
và các placeholder như `{{monday:YYYY-MM-DD}}`.

## Command Palette

- **Calendar Deadlines: Open view** — mở lại hoặc hiện panel.
- **Calendar Deadlines: Open Weekly Note** — mở/tạo ghi chú tuần hiện tại.
- **Calendar Deadlines: Reveal active note** — chuyển lịch tới Daily/Weekly Note đang mở.

Các lệnh cần panel sẽ mở lại panel nếu đã đóng. Ctrl/Cmd-click ngày mở ghi chú
trong pane khác. Ctrl/Cmd-hover hỗ trợ preview; chuột phải lên ngày/tuần có ghi
chú để mở file menu.

## Tùy chỉnh CSS và tích hợp

CSS lịch được giới hạn trong `.calendar-deadlines-root` để tránh tác động lên
Calendar gốc. Timeline dùng `.calendar-deadlines`.
Nền bảng và dấu chấm được reset trong phạm vi này để snippet Calendar cũ
không giữ nền tối khi Obsidian chuyển sang light mode; không cần tắt snippet
nếu các plugin khác vẫn dùng nó.

Timeline không giới hạn chiều cao; tùy chỉnh `--calendar-deadlines-height` của
các bản cũ không còn được sử dụng.

Plugin khác có thể nghe event **`calendar-deadlines:open`**, nhận mảng nguồn dữ
liệu `ICalendarSource[]` và thêm nguồn trước khi lịch được tạo. Fork không phát
event `calendar:open` của plugin gốc.

## Phát triển

Dùng **Node.js 22** và npm. `package-lock.json` là lockfile của CI và phát hành;
`yarn.lock` được giữ để tương thích checkout cũ.

```sh
npm ci
npm run typecheck
npm test -- --runInBand
npm run build
```

Build tạo `main.js`; Obsidian tải `styles.css` riêng. Test bao phủ parser, locale,
giao tháng, index theo file, lỗi đọc file và cấu hình Weekly Note của fork.
Kiểm tra tự động không thay thế việc thử trực tiếp trong Obsidian và trên mobile.

Kiểm tra hồi quy CSS bằng Firefox thật (Node.js 22, Firefox và `geckodriver`
có sẵn; không cần cài thêm npm dependency):

```sh
# Terminal 1: WebDriver chỉ lắng nghe localhost, dùng profile Firefox tạm.
geckodriver --host 127.0.0.1 --port 4444
# Terminal 2:
node scripts/check-theme.cjs
```

Có thể đặt `WEBDRIVER_URL` nếu dùng cổng khác. Kiểm tra bao gồm chuyển theme,
snippet nền tối ở cả hai thứ tự nạp CSS, màu deadline/quá hạn, chấm ghi chú,
ngày chọn khi hover và phạm vi CSS không ảnh hưởng Calendar gốc.

`manifest.json`, `package.json` và `versions.json` phải đồng bộ phiên bản.
Workflow phát hành chỉ chạy khi push tag phiên bản khớp, đóng gói thư mục
`calendar-deadlines/` và đính kèm đủ ba file cài đặt. Chạy build cục bộ không
commit, push hoặc phát hành plugin.

## Nguồn gốc và giấy phép

**Tác giả Calendar gốc: [Liam Cain](https://github.com/liamcain).**
Mã nguồn gốc: [liamcain/obsidian-calendar-plugin](https://github.com/liamcain/obsidian-calendar-plugin).
Fork Calendar Deadlines được phát triển bởi **[armordkay](https://github.com/armordkay)**.

Phần lịch sử dụng `obsidian-calendar-ui`; giao diện Daily Notes sử dụng
`obsidian-daily-notes-interface`, cũng thuộc hệ sinh thái của Liam Cain.
Phần template ghi chú tuần kế thừa cú pháp từ các dự án này.

Phân phối theo [MIT License](LICENSE). Giữ nguyên thông báo bản quyền của Liam
Cain, cùng thông báo cho các thay đổi của fork.
