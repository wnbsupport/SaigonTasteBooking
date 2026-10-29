# Saigon Taste Booking

Hệ thống đặt bàn trung tâm cho các nhà hàng Saigon Taste (hiện có **Mandoline** và **Touchstone Cafe**).

- **Form đặt bàn** trên website WordPress của từng quán (plugin trong `wordpress-plugin/`), hoặc trang đặt bàn riêng `/book/<tên-quán>` cho quán chưa có website.
- **App quản lý** (PWA, tiếng Việt/tiếng Anh): xác nhận hoặc từ chối booking, khách nhận email từ hộp mail của chính quán.
- Chặn đặt ngoài giờ ở phía server theo giờ mở cửa, ngày đặc biệt, thời gian đặt trước, sức chứa của từng quán.

## Thành phần

| Thư mục | Nội dung |
|---|---|
| `index.js`, `src/` | Server Node.js (Express + Knex/MySQL) |
| `src/routes/public.js` | API cho form đặt bàn (plugin WordPress dùng khóa kết nối; trang `/book/<slug>`) |
| `src/lib/rules.js` | Quy tắc giờ mở cửa, khung giờ, múi giờ Úc, SĐT Úc |
| `src/lib/mailer.js` | Gửi email: hộp mail SiteGround của quán, dự phòng bằng hộp mail hệ thống |
| `src/lib/jobs.js` | Việc chạy nền mỗi phút: nhắc quán, hết hạn booking, gửi lại email lỗi |
| `src/lib/deploys.js` | Tự xóa bản deploy cũ trên SiteGround (giữ số inode thấp) |
| `migrations/` | Cấu trúc database (Knex). **Không xóa hay đổi tên file đã chạy trên server.** |
| `public/` | App quản lý (không cần build), form đặt bàn `public/widget/` |
| `wordpress-plugin/saigontaste-booking/` | Plugin WordPress |
| `test/` | Test tự động |

## Quy tắc đặt bàn

- Mỗi quán có giờ nhận đặt bàn theo tuần (nhiều ca mỗi ngày), ngày đặc biệt (nghỉ lễ hoặc giờ khác), bước khung giờ 15/30 phút, nhận khách cuối trước giờ đóng, đặt trước tối thiểu, đặt xa tối đa, số khách tối đa mỗi booking, tổng khách mỗi khung giờ.
- Giờ tính theo **múi giờ của quán** (đúng cả khi đổi giờ mùa hè ở Melbourne/Sydney).
- Khách gửi yêu cầu, booking ở trạng thái **Chờ xác nhận** và quán nhận email báo. Nhân viên bấm **Xác nhận** thì khách nhận email xác nhận; **Từ chối** thì khách nhận email kèm lý do.
- Chờ quá thời gian cài đặt (mặc định 30 phút) thì quán nhận email nhắc. Booking chờ mà đã qua giờ hẹn tự chuyển **Hết hạn**.
- Nhân viên tự thêm booking nhận qua điện thoại (đã xác nhận). Chủ được phép ghi đè ngoài giờ/vượt sức chứa.

## Email

- Mỗi quán cài **hộp mail SiteGround của quán** trong app (Cài đặt quán → Email gửi khách). Mật khẩu được mã hóa bằng `ENCRYPTION_KEY`.
- Khách thấy tên và địa chỉ của quán; khách trả lời thì thư về email quán.
- Hộp mail của quán chưa cài hoặc bị lỗi thì **hộp mail hệ thống** (biến `SMTP_*`) gửi thay, vẫn hiện tên quán. App báo lỗi để chủ sửa.
- Mọi email được lưu vào database trước khi gửi; gửi lỗi thì tự thử lại tối đa 5 lần.

## Bảo mật

- Đăng nhập bằng email + mật khẩu (tối thiểu 10 ký tự, bcrypt). Quên mật khẩu qua link email (hiệu lực 1 giờ); mời nhân viên bằng link (7 ngày).
- Sai mật khẩu 5 lần liên tiếp: khóa 15 phút và chủ nhận email cảnh báo.
- Tự đăng xuất khi không dùng (mặc định 30 phút, chủ chỉnh được). Việc app tự cập nhật danh sách không tính là "đang dùng".
- Nhân viên chỉ thấy quán được giao; chỉ Chủ vào được Cài đặt quán, Tài khoản, Nhật ký.
- Nhật ký ghi mọi thao tác (booking, cài đặt, đăng nhập), chỉ đọc.
- Khóa kết nối website chỉ lưu dạng hash; plugin WordPress gọi app từ phía server nên khóa không lộ ra trình duyệt.

## Chạy trên máy (phát triển)

```bash
npm install
cp .env.example .env     # để trống DB_NAME → dùng SQLite (dev.sqlite)
# điền ADMIN_EMAIL, ADMIN_PASSWORD, ENCRYPTION_KEY, APP_URL=http://localhost:3000
npm run dev
```

Mở http://localhost:3000. Không cài SMTP thì email chỉ được lưu (xem trong Chi tiết booking).

## Test

```bash
npm test                                            # SQLite
TEST_MYSQL=user:pass@127.0.0.1/dbname npm test      # chạy cùng bộ test trên MariaDB/MySQL (xóa sạch database đó)
```

## Plugin WordPress

```bash
npm run plugin:zip    # → dist/saigontaste-booking.zip (copy form từ public/widget vào plugin)
```

Sửa form trong `public/widget/` rồi chạy lại lệnh trên để plugin có bản mới.

## Triển khai trên SiteGround

Xem hướng dẫn từng bước trong `docs/TRIEN-KHAI.md`. Tóm tắt:

1. Site Tools → MySQL: tạo database + user (All privileges).
2. Devs → Node.js: tạo app từ GitHub `wnbsupport/SaigonTasteBooking`, nhánh `main`, start file `index.js`, build command chỉ nhập `run build`.
3. Nhập biến môi trường theo `.env.example`, deploy.
4. Trỏ tên miền + bật SSL, mở `https://<tên-miền>/api/health` phải thấy `"ok": true`.
5. Đăng nhập, xóa `ADMIN_PASSWORD`, cài hộp mail và khóa kết nối cho từng quán, cài plugin lên 2 website.

Mỗi lần push lên `main`, SiteGround tự deploy lại. App tự xóa bản deploy cũ để không vượt giới hạn inode.
