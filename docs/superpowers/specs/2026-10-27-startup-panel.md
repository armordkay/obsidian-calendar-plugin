# Tùy chọn tự mở panel khi khởi động

## Yêu cầu

Thêm công tắc ON/OFF trong cài đặt Calendar Deadlines, cùng nhóm với
“Show week number”, để quyết định plugin có tự mở panel khi vào Obsidian.
Debug các lỗi phát sinh từ việc bổ sung tùy chọn này.

## Quyết định đã duyệt

- Khóa lưu: `openOnStartup: boolean` trong `data.json` của plugin.
- Mặc định `true` (ON), giữ hành vi hiện tại cho cấu hình cũ chưa có khóa mới.
- Nhãn: **Open panel on startup**; đặt ngay sau **Show week number**.
- Mô tả: **Automatically open Calendar Deadlines when Obsidian starts or this plugin is enabled. Changes apply the next time the plugin loads.**
- OFF: plugin không tự tạo panel, chuyển tab hoặc gọi `revealLeaf` khi layout sẵn sàng.
- ON: giữ luồng tự mở hiện tại; tái sử dụng panel có sẵn, không tạo bản sao.
- Thay đổi công tắc được lưu ngay, có hiệu lực ở lần nạp plugin tiếp theo;
  không mở/đóng panel đang dùng ngay khi gạt công tắc.
- Đọc giá trị mới nhất khi callback layout chạy, không chụp giá trị cũ lúc đăng ký.
- Các lệnh mở panel thủ công vẫn hoạt động khi OFF.
- Obsidian vẫn có thể khôi phục panel từ workspace đã lưu. OFF chỉ tắt việc
  plugin chủ động hiện panel; không đóng panel đã được Obsidian khôi phục.
- Nếu plugin đã bị unload trước khi layout sẵn sàng hoặc trong lúc mở panel,
  không được làm panel hiện trở lại.

## Giới hạn

- Giữ `calendar-deadlines`, phiên bản `1.0.0`, `minAppVersion: 1.0.0`.
- Không thêm dependency, không thay đổi CSS hoặc logic deadline.
- Không commit, push, publish, deploy hay ghi vào vault nếu chưa được yêu cầu.
- Kiểm thử tự động với mock Obsidian không thay thế kiểm tra workspace thực tế.
