# Hướng dẫn triển khai Saigon Taste Booking trên SiteGround

Hướng dẫn này chỉ dùng **Site Tools**, **Client Area** của SiteGround và **trang quản trị WordPress**. Không cần SSH.

Thời gian dự kiến: khoảng 1–2 giờ. Làm theo đúng thứ tự.

Trong hướng dẫn, `booking.saigontaste.com.au` là tên miền ví dụ của app quản lý. Thay bằng tên miền bạn chọn.

---

## Bước 0. Chuẩn bị

Ghi lại các thông tin sau vào một chỗ an toàn (ví dụ trình quản lý mật khẩu):

| Mục | Ví dụ | Ghi chú |
|---|---|---|
| Tên miền app | `booking.saigontaste.com.au` | Dùng cho app quản lý |
| Email chủ | email của bạn | Tài khoản Chủ đầu tiên |
| Mật khẩu chủ | ít nhất 10 ký tự | Chỉ dùng lần đầu |
| ENCRYPTION_KEY | chuỗi ngẫu nhiên 32 ký tự | Tạo bằng trình tạo mật khẩu. **Lưu lại, không được mất** |

---

## Bước 1. Hộp mail hệ thống

Hộp mail này gửi email đặt lại mật khẩu, mời nhân viên, cảnh báo đăng nhập, báo booking mới cho quán. Nó cũng gửi thay khi hộp mail riêng của quán bị lỗi.

1. Mở **Site Tools** của website có tên miền dùng cho email hệ thống, ví dụ `saigontaste.com.au`. Nếu chưa có, dùng tạm website Mandoline.
2. **Email → Accounts → Create**, tạo `bookings@saigontaste.com.au` và đặt mật khẩu mạnh.
3. Ở hộp mail vừa tạo, bấm menu **⋮ → Mail Configuration → Manual Settings**. Ghi lại **Outgoing server (SMTP)** và cổng **465**.
4. **Email → Authentication**: kiểm tra **DKIM** và **SPF** đang bật.

---

## Bước 2. Database MySQL

1. Trong Site Tools nơi sẽ chạy app: **Site → MySQL → Databases → Create Database**. Ghi lại tên database.
2. **Users → Create User**: ghi lại tên user và mật khẩu.
3. Ở user vừa tạo, bấm **⋮ → Manage Access**, chọn database ở bước 1, quyền **All privileges**, rồi **Confirm**.

---

## Bước 3. Tạo app Node.js từ GitHub

1. **Client Area → Websites → Node.js Projects → Create** (hoặc trong Site Tools: **Devs → Node.js**).
2. Chọn kết nối **GitHub**, repo `wnbsupport/SaigonTasteBooking`, nhánh **main**.
3. Cài đặt:
   - App root: thư mục gốc của repo (để mặc định)
   - Start file: `index.js`
   - Node version: 22 (hoặc mới nhất có sẵn)
   - **Build command**: ô này đã có sẵn chữ `npm` phía trước, **chỉ gõ `run build`**. Nếu gõ `npm run build` sẽ thành `npm npm …` và bị lỗi.
4. **Environment variables**: thêm từng dòng sau.

| Biến | Giá trị |
|---|---|
| `APP_URL` | `https://booking.saigontaste.com.au` |
| `DB_HOST` | `localhost` |
| `DB_NAME` | tên database ở Bước 2 |
| `DB_USER` | user ở Bước 2 |
| `DB_PASSWORD` | mật khẩu user ở Bước 2 |
| `ADMIN_EMAIL` | email chủ |
| `ADMIN_PASSWORD` | mật khẩu chủ (ít nhất 10 ký tự) |
| `ENCRYPTION_KEY` | chuỗi ngẫu nhiên ở Bước 0 |
| `SMTP_HOST` | máy chủ SMTP ở Bước 1 |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `bookings@saigontaste.com.au` |
| `SMTP_PASS` | mật khẩu hộp mail ở Bước 1 |
| `MAIL_FROM` | `bookings@saigontaste.com.au` |
| `NODE_OPTIONS` | `--v8-pool-size=2` |
| `UV_THREADPOOL_SIZE` | `2` |

5. Bấm **Deploy** và chờ deploy xong.

> Không xóa file `.nodeapp/.env-local` trong File Manager. Đó là nơi SiteGround lưu các biến trên.

---

## Bước 4. Tên miền và HTTPS

1. Trong Node.js Project, vào phần **Domain**, trỏ `booking.saigontaste.com.au` vào app theo hướng dẫn của SiteGround. Nếu tên miền quản lý DNS ở nơi khác, thêm bản ghi DNS mà SiteGround yêu cầu.
2. **Security → SSL Manager**: cài SSL miễn phí cho tên miền này và bật **HTTPS Enforce**.
3. Mở `https://booking.saigontaste.com.au/api/health`. Kết quả đúng:

```json
{"ok":true,"database":"ok", ...}
```

Nếu thấy `"ok":false`, đọc dòng `error`. App giải thích lỗi bằng tiếng Việt, ví dụ sai mật khẩu MySQL hoặc sai tên database. Sửa biến môi trường rồi deploy lại.

---

## Bước 5. Đăng nhập lần đầu

1. Mở `https://booking.saigontaste.com.au` và đăng nhập bằng `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
2. **Quan trọng:** quay lại Environment variables, **xóa `ADMIN_PASSWORD`**, rồi deploy lại.
3. Vào tab **Tài khoản → Hệ thống**, kiểm tra:
   - Database: Hoạt động
   - Hộp mail hệ thống: có địa chỉ (không phải "Chưa cài")
   - ENCRYPTION_KEY: Có
   - Không còn cảnh báo ADMIN_PASSWORD
   - "Tự xóa bản deploy cũ" đang bật

---

## Bước 6. Kiểm tra thông tin 2 quán

App đã tạo sẵn **Mandoline** và **Touchstone Cafe** theo thông tin trên 2 website hiện tại. Vào **Cài đặt quán** và kiểm tra lại cho từng quán:

- **Giờ nhận đặt bàn hàng tuần**: giờ khách được đặt, không phải giờ mở cửa. Ví dụ Mandoline đang để `08:00-17:00` mỗi ngày, thêm ca tối `18:00-21:00` từ Thứ 4 đến Thứ 7.
- **Ngày đặc biệt**: Christmas, Boxing Day, các ngày nghỉ khác.
- **Quy tắc**: đặt trước tối thiểu, số khách tối đa mỗi booking, thời gian nhắc.
- **Sức chứa**: "Tối đa khách trong quán cùng lúc" (số ghế thực tế muốn nhận qua booking) và "Khách ngồi trung bình" (trước 17:00 và từ 17:00). Ví dụ Touchstone ngồi khoảng 60 phút, Mandoline buổi tối khoảng 90 phút.
- **Email quán**: email nhận báo booking mới và nhận thư khách trả lời.
- **Link chính sách bảo mật**: link trang Privacy Policy của website quán (theo Privacy Act Úc).

Sửa xong bấm **Lưu thay đổi**.

---

## Bước 7. Hộp mail riêng của từng quán

Làm cho **từng quán** (Mandoline, Touchstone Cafe):

1. Mở **Site Tools của website quán → Email → Accounts → Create**, tạo ví dụ `bookings@mandolinerestaurant.com.au`.
   - Touchstone: tạo trên tên miền có mục Email trong Site Tools (`touchstonecafe.com.au` hoặc `touchstonecafe.au`).
2. **⋮ → Mail Configuration → Manual Settings**: ghi lại **Outgoing server (SMTP)**.
3. **Email → Authentication**: kiểm tra DKIM và SPF đang bật.
4. Trong app, vào **Cài đặt quán → Email gửi khách** và nhập (khách trả lời email xác nhận thì thư về chính hộp mail này, nên chọn hộp mail có người đọc):
   - Tên người gửi khách thấy: `Mandoline`
   - Máy chủ SMTP: ở mục 2
   - Cổng: `465`
   - Email gửi đi: `bookings@mandolinerestaurant.com.au`
   - Mật khẩu hộp mail
5. Bấm **Lưu thay đổi**, sau đó **Gửi thử** tới email của bạn. Phải thấy dòng xanh "Đã gửi thử thành công" và nhận được email.

---

## Bước 8. Khóa kết nối website

Làm cho từng quán: **Cài đặt quán → Kết nối website → Tạo khóa mới**, rồi **Copy** khóa. Khóa chỉ hiện đầy đủ một lần. Mất khóa thì tạo khóa mới.

---

## Bước 9. Cài plugin lên website WordPress

Làm cho từng website (mandolinerestaurant.com.au, touchstonecafe.au):

1. **WordPress → Plugins → Add New → Upload Plugin**, chọn file `saigontaste-booking.zip`, cài rồi **Activate**.
2. **Settings → Saigon Taste Booking**:
   - App address: `https://booking.saigontaste.com.au`
   - Connection key: khóa của **đúng quán đó** (Bước 8)
   - Button colour: màu nút theo website (không bắt buộc)
   - Bấm **Save Changes**, rồi **Test connection**. Phải thấy "Connected to Mandoline" (hoặc Touchstone Cafe).
3. Mở trang đặt bàn hiện tại (`/booking/` hoặc `/wp-booking-calendar/`):
   - Xóa form cũ của plugin **Booking Calendar**.
   - Thêm khối **Shortcode** với nội dung `[saigontaste_booking]`.
   - **Update**.
4. **Site Tools → Speed → Caching → Flush Cache** để khách thấy trang mới ngay.
5. Mở trang đặt bàn bằng điện thoại và đặt thử một bàn (Bước 11).

### Chuyển booking cũ và tắt Booking Calendar

1. Trong WordPress, mở danh sách booking của plugin **Booking Calendar** và xem các booking **từ hôm nay trở đi**.
2. Nhập lại từng booking vào app bằng **+ Thêm booking**. Bỏ chọn "Gửi email xác nhận" nếu khách đã được xác nhận trước đó.
3. Kiểm tra xong thì **Deactivate** plugin Booking Calendar. Chưa cần xóa ngay.

---

## Bước 10. Nhân viên và iPad ở quầy

1. **Tài khoản → Thêm người dùng**: nhập họ tên, email, vai trò **Nhân viên**, chọn quán và ngôn ngữ, rồi **Gửi lời mời**. Nhân viên nhận email để tự đặt mật khẩu. Nếu email chưa tới, gửi họ link hiện trên màn hình.
2. Trên iPad hoặc điện thoại ở quầy:
   - Mở app bằng Safari, bấm **Chia sẻ → Thêm vào MH chính**.
   - Mở app từ biểu tượng trên màn hình chính, đăng nhập, bật **🔔 Âm thanh**.
3. **Tài khoản → Bảo mật**: chọn thời gian tự đăng xuất. iPad quầy dùng cả ca thì nên chọn 4 giờ hoặc 12 giờ.

---

## Bước 11. Kiểm tra trước khi dùng thật

- [ ] Đặt thử trên website Mandoline. Quán nhận email "New booking request", app hiện booking mới và có chuông.
- [ ] Chọn một ngày quán nghỉ: form báo đóng cửa, không cho chọn giờ.
- [ ] Trong app bấm **Xác nhận**: khách nhận email từ `bookings@mandolinerestaurant.com.au`. Trả lời email đó thì thư về hộp mail `bookings@` này.
- [ ] Thêm vài booking cùng giờ cho tới khi đầy: form website gạch các giờ bị trùng, kể cả khung liền kề trong thời gian khách ngồi.
- [ ] Đặt thử và **Từ chối** kèm lý do: khách nhận email có lý do.
- [ ] Làm lại 3 mục trên với Touchstone Cafe.
- [ ] Đăng nhập tài khoản nhân viên: chỉ thấy quán của mình.
- [ ] **In / Xuất CSV** hiện danh sách khách trong ngày.
- [ ] **Nhật ký** ghi đủ các thao tác vừa làm.
- [ ] Hủy hoặc đánh dấu các booking thử để không lẫn với khách thật.

---

## Cập nhật sau này

- Mỗi lần có bản mới trên GitHub (nhánh `main`), SiteGround tự deploy lại. Không cần làm gì thêm.
- App tự xóa các bản deploy cũ trong `public_html/.nodeapp` khoảng 3 phút sau mỗi lần khởi động, để không vượt giới hạn inode.
- Nếu người dùng vẫn thấy bản cũ trên iPad: đóng hẳn app rồi mở lại.
- Plugin WordPress có bản mới: Plugins → Upload Plugin → chọn file zip mới → **Replace current with uploaded**.

---

## Gặp lỗi

| Hiện tượng | Cách xử lý |
|---|---|
| Build lỗi, log có `npm npm …` | Ô Build command chỉ gõ `run build` |
| Trang báo **502** ngay sau deploy | Chờ 1–2 phút rồi tải lại. Mở `/api/health` xem lỗi database. Kiểm tra `NODE_OPTIONS` và `UV_THREADPOOL_SIZE` đã có |
| Log có `Failed to fork` | Thiếu `NODE_OPTIONS=--v8-pool-size=2` hoặc `UV_THREADPOOL_SIZE=2` |
| `/api/health` báo lỗi MySQL | Làm theo dòng `error` (sai mật khẩu, sai tên database, chưa cấp quyền) |
| Website báo "This booking form is not connected yet" | Sai hoặc thiếu khóa. Tạo khóa mới trong app, dán lại vào plugin, bấm Test connection |
| Gửi thử email lỗi "sai email hoặc mật khẩu SMTP" | Kiểm tra lại mật khẩu hộp mail, hoặc đặt lại mật khẩu trong Site Tools rồi nhập lại |
| Khách không nhận được email | Xem **Chi tiết** booking → mục Email (đã gửi, lỗi, gửi bằng hộp mail nào). Bảo khách xem mục Spam. Kiểm tra DKIM/SPF |
| Cảnh báo SiteGround quá nhiều inode | Kiểm tra "Tự xóa bản deploy cũ" đang bật (Tài khoản → Hệ thống). Dọn tay lần đầu: File Manager → `public_html/.nodeapp`, giữ `1234567890-origin`, thư mục `latest` trỏ tới, thư mục ngay trước nó, `.env-local`, `app.json`, `app_source.zip`, `latest`; xóa các thư mục số còn lại, mỗi lần khoảng 5 thư mục |
| Quên mật khẩu chủ | Bấm "Quên mật khẩu?" ở trang đăng nhập |
| Mất `ENCRYPTION_KEY` | Đặt khóa mới, deploy lại, rồi nhập lại mật khẩu hộp mail của từng quán |
