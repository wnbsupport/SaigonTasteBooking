/* Saigon Taste Booking – manager app (no build step). */
(function () {
'use strict';

/* ============ helpers ============ */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const ls = { get(k, d) { try { const v = localStorage.getItem('st.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('st.' + k, JSON.stringify(v)); } catch { /* private mode */ } } };

/* ============ language ============ */
const DICT = {
  vi: {
    signIn: 'Đăng nhập', email: 'Email', password: 'Mật khẩu', forgot: 'Quên mật khẩu?', wrong: 'Email hoặc mật khẩu không đúng.', left: 'Còn {n} lần thử trước khi tài khoản bị khóa.',
    locked: 'Tài khoản đang tạm khóa vì nhập sai nhiều lần. Thử lại sau {n} phút.', justLocked: 'Sai mật khẩu {n} lần. Tài khoản bị khóa {m} phút và chủ đã nhận email cảnh báo.',
    sessionOut: 'Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.', remember: 'Ghi nhớ đăng nhập trên thiết bị này', rememberHint: 'Bỏ tick khi dùng máy lạ hoặc máy dùng chung.',
    logoutAll: 'Đăng xuất khỏi mọi thiết bị', logoutAllQ: 'Đăng xuất khỏi mọi thiết bị?', logoutAllMe: 'Tất cả iPad, điện thoại, máy tính đang đăng nhập bằng tài khoản của bạn sẽ phải đăng nhập lại, kể cả thiết bị này.', logoutAllUser: '{n} sẽ phải đăng nhập lại trên mọi thiết bị.', loggedOutAll: 'Đã đăng xuất khỏi mọi thiết bị', devices: 'Đang đăng nhập trên {n} thiết bị', noDevices: 'Không đăng nhập trên thiết bị nào',
    forgotTitle: 'Quên mật khẩu', forgotHelp: 'Nhập email đăng nhập. Nếu email có tài khoản, hệ thống gửi link đặt mật khẩu mới (hiệu lực 1 giờ).', sendLink: 'Gửi link', back: 'Quay lại', linkSent: 'Nếu email có tài khoản, link đã được gửi. Kiểm tra hộp thư (cả mục Spam).',
    setPw: 'Đặt mật khẩu', setPwFor: 'Đặt mật khẩu cho {email}', newPw: 'Mật khẩu mới (ít nhất 10 ký tự)', newPw2: 'Nhập lại mật khẩu', pwShort: 'Mật khẩu cần ít nhất 10 ký tự.', pwMismatch: 'Hai mật khẩu không giống nhau.', tokenBad: 'Link này đã hết hạn hoặc đã được dùng. Bấm "Quên mật khẩu?" để nhận link mới.', saveAndSignIn: 'Lưu và đăng nhập', welcome: 'Chào {name}',
    signOut: 'Đăng xuất', owner: 'Chủ', staff: 'Nhân viên', allRest: 'Tất cả quán', sound: 'Âm thanh', soundOn: 'Đã bật chuông báo booking mới', soundOff: 'Đã tắt chuông',
    tBookings: 'Booking', tRest: 'Cài đặt quán', tUsers: 'Tài khoản', tLog: 'Nhật ký',
    st_pending: 'Chờ xác nhận', st_confirmed: 'Đã xác nhận', st_seated: 'Đã đến', st_noshow: 'Không đến', st_declined: 'Từ chối', st_cancelled: 'Đã hủy', st_expired: 'Hết hạn', all: 'Tất cả',
    waiting: 'Cần xác nhận', nothingWaiting: 'Không còn booking nào chờ. Booking mới từ website sẽ hiện ở đây.', today: 'Hôm nay', todaySuffix: ' · hôm nay', prevDay: 'Ngày trước', nextDay: 'Ngày sau',
    bookingsN: 'Booking', guestsExp: 'Khách dự kiến', pendingN: 'Chờ xác nhận', noneDay: 'Chưa có booking nào trong ngày.', print: 'In / Xuất CSV', add: '+ Thêm booking',
    guests: 'khách', newChip: 'Mới', waitFor: 'Chờ {d}', web: 'Website', hosted: 'Trang đặt bàn', byStaff: 'Nhân viên nhập', regular: 'Khách quen · {n} lần đến', visit1: 'Đã đến 1 lần', noshows: '{n} lần không đến',
    confirm: 'Xác nhận', decline: 'Từ chối', cancel: 'Hủy', seated: 'Đã đến', noshow: 'Không đến', undo: 'Hoàn tác', details: 'Chi tiết', close: 'Đóng', no: 'Thôi',
    newArrived: '{n} booking mới vừa vào', markSeen: 'Đã xem', pwaTitle: 'Cài app lên iPad hoặc điện thoại ở quầy', pwaText: 'Mở app trên Safari, bấm nút Chia sẻ rồi chọn “Thêm vào MH chính”. Bật Âm thanh ở góc trên để có chuông khi có booking mới. Danh sách tự cập nhật, không cần tải lại trang.', gotIt: 'Đã hiểu',
    offline: 'Mất kết nối. Danh sách có thể chưa mới nhất, app sẽ tự thử lại.',
    confirmTitle: 'Xác nhận booking', guestGets: 'Khách sẽ nhận email này:', noEmail: 'Booking này không có email nên khách không nhận được email xác nhận.', confirmSend: 'Xác nhận & gửi email', confirmed: 'Đã xác nhận · email đang gửi tới {e}', confirmedNoMail: 'Đã xác nhận',
    fallbackWarn: 'Hộp mail riêng của quán chưa cài hoặc đang lỗi, email sẽ gửi bằng hộp mail hệ thống (vẫn hiện tên quán).',
    declineTitle: 'Từ chối booking', reasonGuest: 'Lý do (khách sẽ thấy, nên viết tiếng Anh, không bắt buộc)', reasonPh: 'Fully booked at that time', previewMail: 'Xem email', declineSend: 'Từ chối & gửi email', declined: 'Đã từ chối · email đang gửi cho khách',
    cancelTitle: 'Hủy booking', reasonInternal: 'Lý do (ghi nội bộ, bắt buộc)', needReason: 'Cần ghi lý do.', cancelled: 'Đã hủy booking', markedSeated: '{n} đã đến', markedNoshow: 'Đã ghi {n} không đến', undone: 'Đã hoàn tác',
    changed: 'Booking này vừa được người khác thay đổi. Danh sách đã được cập nhật.',
    hist: 'Lịch sử booking', otherBookings: 'Các lần đặt khác của khách này', emailsSent: 'Email', emailView: 'Email đã gửi', requests: 'Yêu cầu', ref: 'Mã',
    em_sent: 'đã gửi', em_pending: 'đang gửi', em_failed: 'lỗi', em_logged: 'chưa gửi (chưa cài mail)', via_restaurant: 'hộp mail quán', via_fallback: 'hộp mail hệ thống (dự phòng)', via_system: 'hộp mail hệ thống', via_restaurant_fb: 'hộp mail quán (dự phòng)', via_log: '',
    ev_created_web: 'Khách gửi yêu cầu đặt bàn', ev_created_staff: 'Nhân viên tạo booking (đã xác nhận)', ev_created_override: 'Chủ tạo booking ngoài quy tắc giờ', ev_confirm: 'Xác nhận', ev_decline: 'Từ chối', ev_cancel: 'Hủy', ev_seated: 'Đánh dấu đã đến', ev_noshow: 'Đánh dấu không đến', ev_undo: 'Hoàn tác về Đã xác nhận', ev_expired: 'Hết hạn · không ai xác nhận trước giờ hẹn', ev_reminded: 'Đã gửi email nhắc quán (chờ quá {d} phút)', ev_email_confirm: 'Gửi email xác nhận tới {d}', ev_email_decline: 'Gửi email từ chối tới {d}',
    guest_: 'Khách – website', system_: 'Hệ thống',
    addTitle: 'Thêm booking (khách gọi điện, nhắn tin…)', restaurant: 'Quán', guestsLbl: 'Số khách', date: 'Ngày', time: 'Giờ ({c})', phone: 'SĐT', guestName: 'Tên khách', guestEmail: 'Email khách (không bắt buộc)', reqLbl: 'Yêu cầu', override: 'Cho phép ngoài giờ / vượt sức chứa (chỉ chủ)', sendConfirm: 'Gửi email xác nhận cho khách (nếu có email)', saveConfirmed: 'Lưu booking đã xác nhận', added: 'Đã thêm booking',
    guestKnown: 'Khách này đã đặt {n} lần: {s} lần đến, {x} lần không đến.',
    e_required: 'Bắt buộc.', e_invalid: 'Không hợp lệ.', e_phone: 'SĐT Úc không hợp lệ.', e_email: 'Email không hợp lệ.', e_party: 'Số khách không hợp lệ.', e_name: 'Nhập tên khách.', e_time_outside: 'Giờ này ngoài giờ mở cửa của quán (hoặc đã qua).', e_time_full: 'Khung giờ này đã đủ khách.', e_time_required: 'Chọn ngày và giờ.', e_dup: 'Khách này đã có booking trong ngày tại quán (mã {r}).',
    loadTitle: 'Khách trong quán theo giờ', loadNow: 'Lúc {a}–{b}: tối đa {n}{c} khách trong quán (đã tính booking này).', loadOver: 'Vượt sức chứa: lúc {a}–{b} có tối đa {n}/{c} khách.', loadAdd: 'Lúc {a}–{b}: đang có tối đa {n}{c} khách, thêm booking này thành {m}{c}.', loadAddOver: 'Thêm booking này sẽ vượt sức chứa ({m}/{c} khách lúc {a}–{b}).', loadNeedOverride: ' Tick “Cho phép … vượt sức chứa” nếu vẫn muốn nhận.', loadStaffOver: ' Hệ thống sẽ không cho lưu, chọn giờ khác hoặc báo chủ.',
    menu: 'Menu', mPending: 'Cần xác nhận', mDay: 'Theo ngày', andMore: 'và {n} booking khác', call: 'Gọi',
    del: 'Xóa đơn', delTitle: 'Xóa đơn này?', delText: 'Đơn bị xóa vĩnh viễn khỏi hệ thống (kể cả lịch sử và email đã gửi). Khách không nhận được email nào. Thao tác được ghi vào Nhật ký.', delConfirmedWarn: 'Khách đã được xác nhận. Nếu khách không đến nữa, nên bấm Hủy để giữ lịch sử; chỉ Xóa khi đây là đơn thử hoặc đơn rác.', delReason: 'Lý do (ghi vào nhật ký, không bắt buộc)', delGo: 'Xóa vĩnh viễn', deleted: 'Đã xóa đơn',
    printTitle: 'Danh sách khách', printBtn: 'In', csv: 'Tải CSV', notConfirmed: 'chưa xác nhận', total: 'Tổng', venue: 'Quán', pax: 'Số', guest: 'Khách',
    serverErr: 'Có lỗi máy chủ. Thử lại sau ít phút.', netErr: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.', saved: 'Đã lưu',
    // restaurants
    addRest: '+ Thêm quán', paused: ' · tạm ngừng', details_: 'Thông tin quán', online: 'Đang nhận đặt bàn online', name: 'Tên quán', website: 'Website (để trống nếu chưa có)', labelColor: 'Màu nhãn trong app', tz: 'Múi giờ', restPhone: 'SĐT quán', restEmail: 'Email quán (nhận báo booking mới, nhận thư khách trả lời)', address: 'Địa chỉ (in trong email)', extraNote: 'Lời nhắn thêm trong email xác nhận (tiếng Anh)', privacy: 'Link chính sách bảo mật (https://…)',
    rules: 'Quy tắc đặt bàn', r_interval: 'Bước khung giờ', r_lastBefore: 'Nhận khách cuối, trước giờ đóng', r_lead: 'Phải đặt trước ít nhất', r_maxDays: 'Cho đặt xa tối đa (ngày)', r_maxParty: 'Số khách tối đa / booking online', r_cap: 'Tối đa khách trong quán cùng lúc (0 = không giới hạn)', r_stay: 'Khách ngồi trung bình (booking trước 17:00)', r_stayEvening: 'Khách ngồi trung bình (booking từ 17:00)', capNote: 'Khách đang chờ xác nhận cũng được giữ chỗ. Một booking chiếm chỗ trong suốt thời gian ngồi, nên các khung giờ liền nhau được tính chung.', r_remind: 'Email nhắc quán nếu chưa xác nhận sau', expireNote: 'Booking chưa xác nhận mà đã qua giờ hẹn sẽ tự chuyển sang “Hết hạn”.', off: 'Không', min: ' phút', hr: ' giờ', day1: '1 ngày',
    mailTitle: 'Email gửi khách (hộp mail SiteGround của quán)', mailHelp: 'Tạo hộp mail trong Site Tools của website quán (Email → Accounts), ví dụ bookings@tenquan.com.au. Máy chủ SMTP xem ở Mail Configuration → Manual Settings, cổng 465.', fromName: 'Tên người gửi khách thấy', smtpHost: 'Máy chủ SMTP', smtpPort: 'Cổng', smtpUser: 'Email gửi đi (tên đăng nhập)', smtpPass: 'Mật khẩu hộp mail', passSet: 'Đã lưu mật khẩu. Để trống nếu không đổi.', clearPass: 'Xóa mật khẩu đã lưu', testTo: 'Gửi thử tới', sendTest: 'Gửi thử', testOk: 'Đã gửi thử thành công. Kiểm tra hộp thư {e}.', testFail: 'Gửi thử lỗi: {e}', saveFirst: 'Lưu thay đổi trước khi gửi thử.',
    mail_ok: 'Hộp mail quán đang hoạt động', mail_failed: 'Hộp mail quán đang lỗi: {e}. Email tạm gửi bằng hộp mail hệ thống.', mail_none: 'Chưa cài hộp mail quán. Email tạm gửi bằng hộp mail hệ thống.', noEncKey: 'Server chưa có ENCRYPTION_KEY nên chưa lưu được mật khẩu email. Thêm biến này trong SiteGround rồi deploy lại.',
    connTitle: 'Kết nối website', connWp: 'Trên WordPress của {d}: cài plugin Saigon Taste Booking, vào Cài đặt → Saigon Taste Booking, dán địa chỉ app và khóa kết nối, rồi thêm shortcode [saigontaste_booking] vào trang đặt bàn.', connNoSite: 'Quán chưa có website: dùng trang đặt bàn riêng dưới đây (gắn vào Google Maps, Instagram, Facebook).', hostedPage: 'Trang đặt bàn riêng', appAddr: 'Địa chỉ app', keyNow: 'Khóa kết nối', newKey: 'Tạo khóa mới', newKeyQ: 'Tạo khóa kết nối mới?', newKeyText: 'Khóa cũ ngừng hoạt động ngay. Form trên website sẽ báo lỗi cho tới khi bạn dán khóa mới vào plugin.', create: 'Tạo', keyOnce: 'Copy khóa và dán vào plugin ngay. Khóa chỉ hiện đầy đủ một lần này.', copy: 'Copy', copied: 'Đã copy', done: 'Xong',
    week: 'Giờ nhận đặt bàn hàng tuần', weekHelp: 'Ghi các ca, cách nhau bằng dấu phẩy, ví dụ 08:00-17:00, 18:00-21:00. Để trống là nghỉ.', closed: 'Nghỉ', badFmt: 'Sai định dạng. Ví dụ 17:00-22:00',
    special: 'Ngày đặc biệt', specialHelp: 'Nghỉ lễ hoặc giờ khác thường ngày. Để trống giờ là đóng cửa cả ngày. Ghi chú hiện trên form (tiếng Anh).', addDate: '+ Thêm ngày', remove: 'Xóa', noteLbl: 'Ghi chú', checkSpecial: 'Kiểm tra lại các ngày đặc biệt (ngày trùng hoặc giờ sai định dạng).',
    save: 'Lưu thay đổi', savedRest: 'Đã lưu. Form đặt bàn cập nhật ngay.', fixErrors: 'Kiểm tra lại các ô báo lỗi.',
    newRest: 'Thêm quán mới', newRestNote: 'Quán mới có giờ mẫu 11:00–15:00 và 17:00–21:00 mỗi ngày, bạn chỉnh lại sau khi tạo.', restCreated: 'Đã tạo {n}. Kiểm tra giờ mở cửa rồi lưu.',
    // users
    personName: 'Họ tên', users: 'Người dùng', addStaff: 'Thêm người dùng', role: 'Vai trò', access: 'Quán được xem', lang: 'Ngôn ngữ', invite: 'Gửi lời mời', inviteNote: 'Người dùng nhận email mời kèm link tự đặt mật khẩu (hiệu lực 7 ngày). Nhân viên chỉ xem và xử lý booking của quán được giao.', invited: 'Đã gửi lời mời. Nếu email chưa tới, gửi link dưới đây cho người đó:',
    edit: 'Sửa', active: 'Đang hoạt động', inactive: 'Đã khóa', lockedNow: 'Đang bị khóa đăng nhập', unlock: 'Mở khóa', sendPwLink: 'Gửi link đặt mật khẩu', linkReady: 'Link đã gửi qua email. Có thể gửi trực tiếp link này:', noPw: 'chưa đặt mật khẩu', lastLogin: 'Đăng nhập gần nhất', never: 'chưa đăng nhập',
    e_self: 'Không thể tự khóa hoặc tự hạ quyền tài khoản của mình.', e_lastOwner: 'Phải còn ít nhất một tài khoản Chủ đang hoạt động.', e_exists: 'Email này đã có tài khoản.', e_restaurantIds: 'Chọn ít nhất một quán.',
    security: 'Bảo mật', secNote: 'Không tự đăng xuất khi đang dùng. Thiết bị có tick “Ghi nhớ đăng nhập” giữ đăng nhập tới khi 90 ngày liền không mở app. Nhập sai mật khẩu 5 lần liên tiếp: tài khoản khóa 15 phút và chủ nhận email cảnh báo. Mọi thao tác đều ghi vào Nhật ký.',
    myPw: 'Đổi mật khẩu của tôi', curPw: 'Mật khẩu hiện tại', pwChanged: 'Đã đổi mật khẩu', curWrong: 'Mật khẩu hiện tại không đúng.',
    system: 'Hệ thống', sysDb: 'Database', sysMail: 'Hộp mail hệ thống', sysEnc: 'ENCRYPTION_KEY', sysFailed: 'Email lỗi (7 ngày)', sysVer: 'Phiên bản', yes: 'Có', notSet: 'Chưa cài', okWord: 'Hoạt động',
    adminPwWarn: 'ADMIN_PASSWORD vẫn còn trong biến môi trường. Hãy xóa nó trong SiteGround (Devs → Node.js) rồi deploy lại.',
    cleanup: 'Tự xóa bản deploy cũ trên SiteGround (giữ số inode thấp)', cleanupLast: 'Lần kiểm tra gần nhất: {t} · thư mục đang chạy {r} · đã xóa {n}', cleanupSkip: 'Lần kiểm tra gần nhất: {t} · bỏ qua ({s})', cleanupNone: 'Chưa kiểm tra lần nào (chạy vài phút sau khi app khởi động).',
    // log
    lf_all: 'Tất cả', lf_bookings: 'Booking & cài đặt', lf_security: 'Đăng nhập & bảo mật', when: 'Thời gian', who: 'Người làm', what: 'Hành động', detail: 'Chi tiết', more: 'Xem thêm', logRo: 'Nhật ký chỉ đọc, không ai sửa hay xóa được, kể cả chủ.', noLog: 'Chưa có hoạt động.',
    a_login: 'Đăng nhập', a_login_failed: 'Đăng nhập sai', a_login_locked: 'Khóa đăng nhập', a_logout: 'Đăng xuất', a_logout_all: 'Đăng xuất mọi thiết bị', a_user_logout_all: 'Đăng xuất mọi thiết bị của người dùng', a_auto_logout: 'Tự đăng xuất (không dùng)', a_password_reset_request: 'Yêu cầu đặt lại mật khẩu', a_password_set: 'Đặt mật khẩu', a_password_changed: 'Đổi mật khẩu', a_lang_changed: 'Đổi ngôn ngữ',
    a_booking_created_web: 'Booking mới từ website', a_booking_created_staff: 'Nhân viên thêm booking', a_booking_confirm: 'Xác nhận booking', a_booking_decline: 'Từ chối booking', a_booking_cancel: 'Hủy booking', a_booking_seated: 'Đánh dấu đã đến', a_booking_noshow: 'Đánh dấu không đến', a_booking_undo: 'Hoàn tác', a_booking_expired: 'Booking hết hạn',
    a_booking_deleted: 'Xóa đơn', a_csv_export: 'Xuất CSV', a_print: 'In danh sách khách', a_restaurant_created: 'Thêm quán', a_restaurant_updated: 'Sửa cài đặt quán', a_key_rotated: 'Tạo khóa kết nối mới', a_mail_test: 'Gửi thử email', a_user_invited: 'Mời người dùng', a_user_updated: 'Sửa người dùng', a_user_link: 'Gửi link mật khẩu', a_user_unlocked: 'Mở khóa đăng nhập', a_settings_updated: 'Sửa cài đặt bảo mật', a_deploy_cleanup: 'Dọn bản deploy cũ',
    weekdays: ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'], wd: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
  },
  en: {
    signIn: 'Sign in', email: 'Email', password: 'Password', forgot: 'Forgot password?', wrong: 'Wrong email or password.', left: '{n} attempts left before the account locks.',
    locked: 'This account is locked after too many wrong passwords. Try again in {n} min.', justLocked: '{n} wrong passwords. The account is locked for {m} minutes and the owner has been emailed.',
    sessionOut: 'Your session has ended. Please sign in again.', remember: 'Keep me signed in on this device', rememberHint: 'Untick on a shared or unfamiliar device.',
    logoutAll: 'Sign out of all devices', logoutAllQ: 'Sign out of all devices?', logoutAllMe: 'Every iPad, phone and computer signed in with your account will need to sign in again, including this one.', logoutAllUser: '{n} will need to sign in again on every device.', loggedOutAll: 'Signed out of all devices', devices: 'Signed in on {n} device(s)', noDevices: 'Not signed in on any device',
    forgotTitle: 'Forgot password', forgotHelp: 'Enter your sign-in email. If it has an account, you get a link to set a new password (valid for 1 hour).', sendLink: 'Send link', back: 'Back', linkSent: 'If that email has an account, the link is on its way. Check your inbox (and spam).',
    setPw: 'Set password', setPwFor: 'Set a password for {email}', newPw: 'New password (at least 10 characters)', newPw2: 'Repeat password', pwShort: 'Use at least 10 characters.', pwMismatch: 'The two passwords are different.', tokenBad: 'This link has expired or was already used. Use "Forgot password?" to get a new one.', saveAndSignIn: 'Save and sign in', welcome: 'Hi {name}',
    signOut: 'Sign out', owner: 'Owner', staff: 'Staff', allRest: 'All restaurants', sound: 'Sound', soundOn: 'New-booking chime on', soundOff: 'Chime off',
    tBookings: 'Bookings', tRest: 'Restaurants', tUsers: 'Accounts', tLog: 'Activity log',
    st_pending: 'Pending', st_confirmed: 'Confirmed', st_seated: 'Arrived', st_noshow: 'No-show', st_declined: 'Declined', st_cancelled: 'Cancelled', st_expired: 'Expired', all: 'All',
    waiting: 'Waiting for confirmation', nothingWaiting: 'Nothing waiting. New website bookings appear here.', today: 'Today', todaySuffix: ' · today', prevDay: 'Previous day', nextDay: 'Next day',
    bookingsN: 'Bookings', guestsExp: 'Expected guests', pendingN: 'Pending', noneDay: 'No bookings on this day.', print: 'Print / CSV', add: '+ Add booking',
    guests: 'guests', newChip: 'New', waitFor: 'Waiting {d}', web: 'Website', hosted: 'Booking page', byStaff: 'Added by staff', regular: 'Regular · {n} visits', visit1: '1 previous visit', noshows: '{n} no-show(s)',
    confirm: 'Confirm', decline: 'Decline', cancel: 'Cancel', seated: 'Arrived', noshow: 'No-show', undo: 'Undo', details: 'Details', close: 'Close', no: 'Back',
    newArrived: '{n} new booking(s)', markSeen: 'Mark as seen', pwaTitle: 'Install the app on the front-desk iPad or phone', pwaText: 'Open the app in Safari, tap Share, then “Add to Home Screen”. Turn on Sound (top right) to hear a chime for new bookings. The list updates itself.', gotIt: 'Got it',
    offline: 'Connection lost. The list may be out of date; the app keeps retrying.',
    confirmTitle: 'Confirm booking', guestGets: 'The guest receives this email:', noEmail: 'No email on this booking, so the guest gets no confirmation email.', confirmSend: 'Confirm & send email', confirmed: 'Confirmed · email on its way to {e}', confirmedNoMail: 'Confirmed',
    fallbackWarn: 'The restaurant mailbox is not set up or failing, so the system mailbox sends this (still showing the restaurant name).',
    declineTitle: 'Decline booking', reasonGuest: 'Reason (the guest sees this, optional)', reasonPh: 'Fully booked at that time', previewMail: 'Preview email', declineSend: 'Decline & send email', declined: 'Declined · email on its way to the guest',
    cancelTitle: 'Cancel booking', reasonInternal: 'Reason (internal, required)', needReason: 'Please add a reason.', cancelled: 'Booking cancelled', markedSeated: '{n} arrived', markedNoshow: '{n} marked as no-show', undone: 'Undone',
    changed: 'Someone else just changed this booking. The list has been refreshed.',
    hist: 'Booking history', otherBookings: 'This guest\'s other bookings', emailsSent: 'Emails', emailView: 'Email sent', requests: 'Requests', ref: 'Ref',
    em_sent: 'sent', em_pending: 'sending', em_failed: 'failed', em_logged: 'not sent (no mailbox set up)', via_restaurant: 'restaurant mailbox', via_fallback: 'system mailbox (fallback)', via_system: 'system mailbox', via_restaurant_fb: 'restaurant mailbox (fallback)', via_log: '',
    ev_created_web: 'Guest sent a booking request', ev_created_staff: 'Added by staff (confirmed)', ev_created_override: 'Added by owner outside the hour rules', ev_confirm: 'Confirmed', ev_decline: 'Declined', ev_cancel: 'Cancelled', ev_seated: 'Marked arrived', ev_noshow: 'Marked no-show', ev_undo: 'Undone back to Confirmed', ev_expired: 'Expired · nobody confirmed before the booking time', ev_reminded: 'Reminder emailed to the restaurant (waiting over {d} min)', ev_email_confirm: 'Confirmation email to {d}', ev_email_decline: 'Decline email to {d}',
    guest_: 'Guest – website', system_: 'System',
    addTitle: 'Add booking (phone, message…)', restaurant: 'Restaurant', guestsLbl: 'Guests', date: 'Date', time: 'Time ({c})', phone: 'Phone', guestName: 'Guest name', guestEmail: 'Guest email (optional)', reqLbl: 'Requests', override: 'Allow outside hours / over capacity (owner only)', sendConfirm: 'Email a confirmation to the guest (if email given)', saveConfirmed: 'Save as confirmed', added: 'Booking added',
    guestKnown: 'This guest has booked {n} time(s): {s} visit(s), {x} no-show(s).',
    e_required: 'Required.', e_invalid: 'Not valid.', e_phone: 'Not a valid Australian number.', e_email: 'Not a valid email.', e_party: 'Invalid number of guests.', e_name: 'Enter the guest name.', e_time_outside: 'That time is outside opening hours (or already passed).', e_time_full: 'That time slot is full.', e_time_required: 'Choose a date and time.', e_dup: 'This guest already has a booking that day (ref {r}).',
    loadTitle: 'Guests in the restaurant by time', loadNow: '{a}–{b}: at most {n}{c} guests in the restaurant (this booking included).', loadOver: 'Over capacity: up to {n}/{c} guests at {a}–{b}.', loadAdd: '{a}–{b}: up to {n}{c} guests now, {m}{c} with this booking.', loadAddOver: 'This booking would go over capacity ({m}/{c} guests at {a}–{b}).', loadNeedOverride: ' Tick “Allow … over capacity” to take it anyway.', loadStaffOver: ' It cannot be saved; choose another time or ask the owner.',
    menu: 'Menu', mPending: 'To confirm', mDay: 'By day', andMore: 'and {n} more', call: 'Call',
    del: 'Delete', delTitle: 'Delete this booking?', delText: 'The booking is removed for good (including its history and sent emails). The guest gets no email. This is recorded in the Activity log.', delConfirmedWarn: 'This guest was confirmed. If they are not coming, Cancel keeps the history; delete only test or spam bookings.', delReason: 'Reason (for the log, optional)', delGo: 'Delete for good', deleted: 'Booking deleted',
    printTitle: 'Guest list', printBtn: 'Print', csv: 'Download CSV', notConfirmed: 'not confirmed', total: 'Total', venue: 'Venue', pax: 'Pax', guest: 'Guest',
    serverErr: 'Server error. Please try again shortly.', netErr: 'Can\'t reach the server. Check the connection and try again.', saved: 'Saved',
    addRest: '+ Add restaurant', paused: ' · paused', details_: 'Restaurant details', online: 'Taking online bookings', name: 'Name', website: 'Website (blank if none)', labelColor: 'Label colour', tz: 'Time zone', restPhone: 'Phone', restEmail: 'Restaurant email (new-booking alerts and guest replies)', address: 'Address (shown in emails)', extraNote: 'Extra note in the confirmation email', privacy: 'Privacy policy link (https://…)',
    rules: 'Booking rules', r_interval: 'Time slot step', r_lastBefore: 'Last booking before closing', r_lead: 'Minimum notice', r_maxDays: 'Book up to (days ahead)', r_maxParty: 'Max guests per online booking', r_cap: 'Max guests in the restaurant at once (0 = no limit)', r_stay: 'Average stay (bookings before 5 pm)', r_stayEvening: 'Average stay (bookings from 5 pm)', capNote: 'Pending bookings hold their seats too. A booking takes seats for its whole stay, so neighbouring times are counted together.', r_remind: 'Remind the restaurant if unconfirmed after', expireNote: 'Unconfirmed bookings whose time has passed become “Expired” automatically.', off: 'Off', min: ' min', hr: ' h', day1: '1 day',
    mailTitle: 'Guest email (restaurant SiteGround mailbox)', mailHelp: 'Create a mailbox in the restaurant website\'s Site Tools (Email → Accounts), e.g. bookings@restaurant.com.au. The SMTP server is under Mail Configuration → Manual Settings, port 465.', fromName: 'Sender name guests see', smtpHost: 'SMTP server', smtpPort: 'Port', smtpUser: 'Sending email (username)', smtpPass: 'Mailbox password', passSet: 'Password saved. Leave blank to keep it.', clearPass: 'Remove saved password', testTo: 'Send test to', sendTest: 'Send test', testOk: 'Test sent. Check the inbox of {e}.', testFail: 'Test failed: {e}', saveFirst: 'Save your changes before sending a test.',
    mail_ok: 'Restaurant mailbox is working', mail_failed: 'Restaurant mailbox is failing: {e}. The system mailbox sends in the meantime.', mail_none: 'No restaurant mailbox yet. The system mailbox sends in the meantime.', noEncKey: 'The server has no ENCRYPTION_KEY, so mailbox passwords cannot be saved. Add it in SiteGround and redeploy.',
    connTitle: 'Website connection', connWp: 'On {d}\'s WordPress: install the Saigon Taste Booking plugin, open Settings → Saigon Taste Booking, paste the app address and the connection key, then add the shortcode [saigontaste_booking] to the booking page.', connNoSite: 'No website: use the hosted booking page below (link it from Google Maps, Instagram, Facebook).', hostedPage: 'Hosted booking page', appAddr: 'App address', keyNow: 'Connection key', newKey: 'New key', newKeyQ: 'Create a new connection key?', newKeyText: 'The old key stops working immediately. The website form fails until you paste the new key into the plugin.', create: 'Create', keyOnce: 'Copy the key into the plugin now. The full key is shown only once.', copy: 'Copy', copied: 'Copied', done: 'Done',
    week: 'Weekly booking hours', weekHelp: 'Sessions separated by commas, e.g. 08:00-17:00, 18:00-21:00. Leave blank for closed.', closed: 'Closed', badFmt: 'Wrong format. Example: 17:00-22:00',
    special: 'Special dates', specialHelp: 'Holidays or different hours. Blank hours = closed all day. The note shows on the form.', addDate: '+ Add date', remove: 'Remove', noteLbl: 'Note', checkSpecial: 'Check the special dates (duplicate date or wrong hours).',
    save: 'Save changes', savedRest: 'Saved. The booking form updates right away.', fixErrors: 'Please fix the highlighted fields.',
    newRest: 'Add a restaurant', newRestNote: 'New restaurants start with sample hours 11:00–15:00 and 17:00–21:00 daily; adjust them after creating.', restCreated: '{n} created. Check the hours, then save.',
    personName: 'Full name', users: 'Users', addStaff: 'Add a user', role: 'Role', access: 'Restaurant access', lang: 'Language', invite: 'Send invite', inviteNote: 'The person gets an invite email with a link to set their password (valid 7 days). Staff only see bookings for their restaurants.', invited: 'Invite sent. If the email does not arrive, send them this link:',
    edit: 'Edit', active: 'Active', inactive: 'Disabled', lockedNow: 'Sign-in locked', unlock: 'Unlock', sendPwLink: 'Send password link', linkReady: 'Link emailed. You can also send this link directly:', noPw: 'no password yet', lastLogin: 'Last sign-in', never: 'never',
    e_self: 'You cannot disable or demote your own account.', e_lastOwner: 'At least one active Owner account must remain.', e_exists: 'That email already has an account.', e_restaurantIds: 'Choose at least one restaurant.',
    security: 'Security', secNote: 'No automatic sign-out while in use. Devices with “Keep me signed in” stay signed in until the app is unused for 90 days. 5 wrong passwords in a row lock the account for 15 minutes and email the owner. Every action is recorded in the Activity log.',
    myPw: 'Change my password', curPw: 'Current password', pwChanged: 'Password changed', curWrong: 'The current password is wrong.',
    system: 'System', sysDb: 'Database', sysMail: 'System mailbox', sysEnc: 'ENCRYPTION_KEY', sysFailed: 'Failed emails (7 days)', sysVer: 'Version', yes: 'Yes', notSet: 'Not set', okWord: 'Working',
    adminPwWarn: 'ADMIN_PASSWORD is still in the environment variables. Remove it in SiteGround (Devs → Node.js) and redeploy.',
    cleanup: 'Remove old SiteGround deploys automatically (keeps inode use low)', cleanupLast: 'Last check: {t} · running folder {r} · removed {n}', cleanupSkip: 'Last check: {t} · skipped ({s})', cleanupNone: 'Not checked yet (runs a few minutes after the app starts).',
    lf_all: 'All', lf_bookings: 'Bookings & settings', lf_security: 'Sign-in & security', when: 'Time', who: 'Who', what: 'Action', detail: 'Details', more: 'Load more', logRo: 'The log is read-only. Nobody can edit or delete entries, including the owner.', noLog: 'No activity yet.',
    a_login: 'Signed in', a_login_failed: 'Failed sign-in', a_login_locked: 'Sign-in locked', a_logout: 'Signed out', a_logout_all: 'Signed out of all devices', a_user_logout_all: 'Signed a user out of all devices', a_auto_logout: 'Auto sign-out (idle)', a_password_reset_request: 'Password reset requested', a_password_set: 'Password set', a_password_changed: 'Password changed', a_lang_changed: 'Language changed',
    a_booking_created_web: 'New website booking', a_booking_created_staff: 'Booking added by staff', a_booking_confirm: 'Booking confirmed', a_booking_decline: 'Booking declined', a_booking_cancel: 'Booking cancelled', a_booking_seated: 'Marked arrived', a_booking_noshow: 'Marked no-show', a_booking_undo: 'Undo', a_booking_expired: 'Booking expired',
    a_booking_deleted: 'Booking deleted', a_csv_export: 'CSV exported', a_print: 'Guest list printed', a_restaurant_created: 'Restaurant added', a_restaurant_updated: 'Restaurant settings changed', a_key_rotated: 'Connection key replaced', a_mail_test: 'Test email', a_user_invited: 'User invited', a_user_updated: 'User changed', a_user_link: 'Password link sent', a_user_unlocked: 'Sign-in unlocked', a_settings_updated: 'Security settings changed', a_deploy_cleanup: 'Old deploys removed',
    weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
};
let LANG = ls.get('lang', 'vi');
const t = (k, v) => { let s = (DICT[LANG] && DICT[LANG][k]) ?? DICT.vi[k] ?? k; if (v && typeof s === 'string') s = s.replace(/\{(\w+)\}/g, (_, x) => (v[x] != null ? v[x] : '')); return s; };
function setLang(l) { LANG = l === 'en' ? 'en' : 'vi'; ls.set('lang', LANG); document.documentElement.lang = LANG; }
setLang(LANG);

/* ============ dates ============ */
const utc = d => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)); };
const addDays = (d, n) => new Date(utc(d).getTime() + n * 864e5).toISOString().slice(0, 10);
const dow = d => utc(d).getUTCDay();
const dayShort = d => `${t('wd')[dow(d)]} ${d.slice(8)}/${d.slice(5, 7)}`;
const dayFull = d => (LANG === 'en' ? `${t('weekdays')[dow(d)]} ${+d.slice(8)}/${+d.slice(5, 7)}/${d.slice(0, 4)}` : `${t('weekdays')[dow(d)]}, ${d.slice(8)}/${d.slice(5, 7)}/${d.slice(0, 4)}`);
function todayIn(tz) { try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); } catch { return new Date().toISOString().slice(0, 10); } }
const stamp = ms => { const d = new Date(ms); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const ago = ms => { const s = (Date.now() - ms) / 1000; if (s < 60) return LANG === 'en' ? 'just now' : 'vừa xong'; if (s < 3600) return Math.floor(s / 60) + (LANG === 'en' ? ' min ago' : ' phút trước'); if (s < 86400) return Math.floor(s / 3600) + (LANG === 'en' ? ' h ago' : ' giờ trước'); return Math.floor(s / 86400) + (LANG === 'en' ? ' days ago' : ' ngày trước'); };
const dur = ms => { const m = Math.floor(ms / 60000); return m < 60 ? m + t('min') : m < 1440 ? Math.floor(m / 60) + t('hr') : Math.floor(m / 1440) + (LANG === 'en' ? ' d' : ' ngày'); };
const mins = v => (v === 0 ? t('off') : v < 60 ? v + t('min') : v === 1440 ? t('day1') : v % 60 ? v + t('min') : v / 60 + t('hr'));

/* ============ API ============ */
let online = true;
async function api(method, path, body, opts = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.background) headers['X-Background'] = '1';
  let res;
  try {
    res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, credentials: 'same-origin', cache: 'no-store' });
  } catch (e) {
    if (online) { online = false; renderOffline(); }
    if (!opts.background) toast(t('netErr'));
    throw Object.assign(new Error('network'), { network: true });
  }
  if (!online) { online = true; renderOffline(); }
  let data = {};
  try { data = await res.json(); } catch { /* empty */ }
  if (res.status === 401) {
    if (opts.allow401) return data;
    sessionEnded(data.reason); throw Object.assign(new Error('auth'), { status: 401, data });
  }
  if (res.status >= 500 && !opts.quiet) toast(t('serverErr'));
  if (!res.ok) throw Object.assign(new Error(data.error || 'http'), { status: res.status, data });
  return data;
}

/* ============ UI primitives ============ */
function toast(m) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = m; $('#toasts').appendChild(el); setTimeout(() => el.remove(), 3600); }
let sheetReturn = null;
function sheet(html, bind) {
  sheetReturn = sheetReturn || document.activeElement;
  $('#layer').innerHTML = `<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-modal="true" tabindex="-1">${html}</div></div>`;
  $('#scrim').addEventListener('click', e => { if (e.target.id === 'scrim' || e.target.closest('[data-close]')) closeSheet(); });
  const s = $('.sheet'); const f = s.querySelector('input:not([type=hidden]),textarea,select'); (f || s).focus({ preventScroll: true });
  if (bind) bind(s);
}
function closeSheet() { $('#layer').innerHTML = ''; if (sheetReturn && sheetReturn.isConnected) sheetReturn.focus({ preventScroll: true }); sheetReturn = null; if (pendingReload) { pendingReload = false; refresh(); } }
const sheetOpen = () => !!$('#scrim');
document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheetOpen()) closeSheet(); });
async function copyText(text, btn) {
  try { await navigator.clipboard.writeText(text); if (btn) { const o = btn.textContent; btn.textContent = t('copied'); setTimeout(() => { btn.textContent = o; }, 1500); } }
  catch { const r = document.createRange(); const n = btn && btn.previousElementSibling; if (n) { r.selectNodeContents(n); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } }
}
const errText = (field, code, extra = {}) => {
  if (field === 'time') return t('e_time_' + code);
  if (field === 'dup') return t('e_dup', { r: code });
  if (field === 'phone' && code !== 'required') return t('e_phone');
  if (field === 'email' && code !== 'required') return t('e_email');
  if (field === 'party') return t('e_party');
  if (field === 'name') return t('e_name');
  if (['self', 'lastOwner', 'restaurantIds'].includes(field)) return t('e_' + field);
  if (code === 'exists') return t('e_exists');
  if (code === 'no_key') return t('noEncKey');
  return t('e_' + code) || t('e_invalid', extra);
};

/* ============ icons (inline SVG, inherit colour) ============ */
const ICON = {
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  rest: '<path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/>',
  users: '<path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 19v-1a4 4 0 0 0-3-3.87M15.5 3.13a3.5 3.5 0 0 1 0 6.75"/>',
  log: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
};
const icon = (k, size = 20) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

/* ============ state ============ */
const S = {
  me: null, restaurants: [], tab: ls.get('tab', 'list'), date: null, rid: 'all', status: 'all',
  pending: [], day: [], summary: { pending: 0, unseen: [], version: '' }, sound: ls.get('sound', false), lastActive: Date.now(), logFilter: 'all',
};
let pendingReload = false;
const rest = id => S.restaurants.find(r => r.id === id) || { name: '?', color: '#888', timezone: 'Australia/Melbourne' };
const isOwner = () => S.me && S.me.user.role === 'owner';

/* ============ boot & routing ============ */
async function boot() {
  const path = location.pathname;
  if (path === '/password') return passwordPage();
  try {
    const me = await api('GET', '/api/auth/me', undefined, { allow401: true });
    if (me.error) return loginView(me.reason === 'expired' ? t('sessionOut') : '');
    signedIn(me);
  } catch (e) { if (!e.network) loginView(); else $('#root').innerHTML = `<div class="wrap"><p class="boot">${esc(t('netErr'))}</p><p class="boot"><button class="btn" id="retry">↻</button></p></div>`, $('#retry').onclick = boot; }
}
function signedIn(me) {
  S.me = me; S.restaurants = me.restaurants; setLang(me.user.lang);
  if (location.pathname === '/print') return printPage();
  if (!S.date) S.date = todayIn(S.restaurants[0] ? S.restaurants[0].timezone : 'Australia/Melbourne');
  if (!isOwner() && S.tab !== 'list') S.tab = 'list';
  render();
  startPolling();
}
function sessionEnded(reason) {
  stopPolling();
  S.me = null; closeSheet();
  if (location.pathname === '/password') return;
  loginView(t('sessionOut'));
}

/* ============ sign-in, forgot, set password ============ */
function langSeg(id) { return `<div class="seg" id="${id}" role="group" aria-label="Language"><button type="button" data-l="vi" aria-pressed="${LANG === 'vi'}">VI</button><button type="button" data-l="en" aria-pressed="${LANG === 'en'}">EN</button></div>`; }
function loginView(msg = '') {
  history.replaceState(null, '', '/');
  $('#root').innerHTML = `<div class="wrap"><div class="login"><div class="panel stack">
    <div class="login-brand"><img src="/brand/logo.png" alt="Saigon Taste" width="150" height="227"></div>
    <div class="row" style="justify-content:space-between"><div><h1 style="font-size:21px">${t('signIn')}</h1><p class="muted">Saigon Taste Booking</p></div>${langSeg('ll')}</div>
    ${msg ? `<p class="note warn">${esc(msg)}</p>` : ''}
    <form id="lf" class="stack" style="gap:12px" novalidate>
      <label class="f" for="l-email">${t('email')}<input id="l-email" type="email" autocomplete="username" value="${esc(ls.get('remember', true) ? ls.get('email', '') : '')}" required></label>
      <label class="f" for="l-pass">${t('password')}<input id="l-pass" type="password" autocomplete="current-password" required></label>
      <label class="check" for="l-rem"><input id="l-rem" type="checkbox" ${ls.get('remember', true) ? 'checked' : ''}> ${t('remember')}</label>
      <p class="muted small" style="margin-top:-6px">${t('rememberHint')}</p>
      <p class="err" id="l-err" role="alert"></p>
      <button class="btn pri" type="submit">${t('signIn')}</button>
      <button class="linkbtn" type="button" id="forgot">${t('forgot')}</button>
    </form></div></div></div>`;
  $$('#ll [data-l]').forEach(b => b.onclick = () => { setLang(b.dataset.l); loginView(msg); });
  $('#forgot').onclick = () => forgotView();
  ($('#l-email').value ? $('#l-pass') : $('#l-email')).focus();
  $('#lf').onsubmit = async e => {
    e.preventDefault();
    const btn = $('#lf button[type=submit]'); btn.disabled = true; $('#l-err').textContent = '';
    try {
      const remember = $('#l-rem').checked;
      const me = await api('POST', '/api/auth/login', { email: $('#l-email').value, password: $('#l-pass').value, remember }, { allow401: true, quiet: true });
      if (me.error) { $('#l-err').textContent = t('wrong') + (me.left ? ' ' + t('left', { n: me.left }) : ''); return; }
      ls.set('remember', remember); ls.set('email', remember ? me.user.email : '');
      signedIn(me);
    } catch (err) {
      const d = err.data || {};
      if (err.status === 423) $('#l-err').textContent = d.justLocked ? t('justLocked', { n: 5, m: d.minutes }) : t('locked', { n: d.minutes });
      else if (err.status === 429) $('#l-err').textContent = t('locked', { n: 15 });
      else if (!err.network) $('#l-err').textContent = t('serverErr');
    } finally { if (btn.isConnected) btn.disabled = false; }
  };
}
function forgotView() {
  $('#root').innerHTML = `<div class="wrap"><div class="login"><div class="panel stack">
    <h1 style="font-size:21px">${t('forgotTitle')}</h1><p class="muted">${t('forgotHelp')}</p>
    <form id="ff" class="stack" style="gap:12px"><label class="f" for="f-email">${t('email')}<input id="f-email" type="email" autocomplete="username" required></label>
    <p id="f-msg"></p><div class="row"><button class="btn pri" type="submit">${t('sendLink')}</button><button class="btn ghost" type="button" id="fback">${t('back')}</button></div></form></div></div></div>`;
  $('#f-email').focus();
  $('#fback').onclick = () => loginView();
  $('#ff').onsubmit = async e => { e.preventDefault(); try { await api('POST', '/api/auth/forgot', { email: $('#f-email').value }, { allow401: true }); $('#f-msg').className = 'note ok'; $('#f-msg').textContent = t('linkSent'); } catch { /* toast shown */ } };
}
async function passwordPage() {
  const token = new URLSearchParams(location.search).get('token') || '';
  let info;
  try { info = await api('GET', '/api/auth/token?token=' + encodeURIComponent(token), undefined, { allow401: true, quiet: true }); setLang(info.lang); }
  catch (e) {
    $('#root').innerHTML = `<div class="wrap"><div class="login"><div class="panel stack"><h1 style="font-size:21px">${t('setPw')}</h1><p class="note bad">${t('tokenBad')}</p><a class="btn" href="/">${t('signIn')}</a></div></div></div>`;
    return;
  }
  $('#root').innerHTML = `<div class="wrap"><div class="login"><div class="panel stack">
    <h1 style="font-size:21px">${esc(t('welcome', { name: info.name }))}</h1><p class="muted">${esc(t('setPwFor', { email: info.email }))}</p>
    <form id="pf" class="stack" style="gap:12px" novalidate>
      <input type="email" autocomplete="username" value="${esc(info.email)}" hidden>
      <label class="f" for="p1">${t('newPw')}<input id="p1" type="password" autocomplete="new-password" minlength="10" required></label>
      <label class="f" for="p2">${t('newPw2')}<input id="p2" type="password" autocomplete="new-password" required></label>
      <p class="err" id="p-err" role="alert"></p><button class="btn pri" type="submit">${t('saveAndSignIn')}</button></form></div></div></div>`;
  $('#p1').focus();
  $('#pf').onsubmit = async e => {
    e.preventDefault();
    const a = $('#p1').value, b = $('#p2').value;
    if (a.length < 10) return ($('#p-err').textContent = t('pwShort'));
    if (a !== b) return ($('#p-err').textContent = t('pwMismatch'));
    try { const me = await api('POST', '/api/auth/password', { token, password: a }, { allow401: true }); history.replaceState(null, '', '/'); signedIn(me); }
    catch (err) { $('#p-err').textContent = err.status === 404 ? t('tokenBad') : err.status === 400 ? t('pwShort') : ''; }
  };
}

/* ============ shell ============ */
function render() {
  if (!S.me) return;
  const u = S.me.user;
  const tabs = [['list', t('tBookings')], ...(isOwner() ? [['rest', t('tRest')], ['users', t('tUsers')], ['log', t('tLog')]] : [])];
  if (!tabs.some(x => x[0] === S.tab)) S.tab = 'list';
  const whoLine = `${esc(u.name)} · ${isOwner() ? t('owner') : t('staff') + ' – ' + S.restaurants.map(r => esc(r.name)).join(', ')}`;
  $('#root').innerHTML = `<header class="top"><div class="wrap">
      <div class="brand"><img src="/brand/mark.png" alt="" width="22" height="30">Saigon Taste</div>
      <div class="who"><span>${whoLine}</span>
        ${langSeg('lang')}
        <label class="check small" for="snd"><input type="checkbox" id="snd" ${S.sound ? 'checked' : ''}> 🔔 ${t('sound')}</label></div>
      <button class="btn sm menu-btn" id="menu" aria-label="${t('menu')}">${S.sound ? '🔔' : ''}${icon('menu')}</button>
    </div><div class="wrap"><nav class="tabs${tabs.length < 2 ? ' one' : ''}">${tabs.map(([k, l]) => `<button data-tab="${k}" aria-current="${S.tab === k}">${icon(k)}<span class="tl">${l}</span>${k === 'list' && S.summary.pending ? `<span class="badge">${S.summary.pending}</span>` : ''}</button>`).join('')}</nav></div></header>
    <main class="wrap app${tabs.length < 2 ? ' nonav' : ''}" id="main"><div id="offline"></div><div id="pane"></div></main>`;
  $('#menu').onclick = () => sheet(`<h2>${t('menu')}</h2><p>${whoLine}</p>${langSeg('mlang')}
      <label class="check" for="msnd"><input type="checkbox" id="msnd" ${S.sound ? 'checked' : ''}> 🔔 ${t('sound')}</label>
      <button class="btn dang" id="mlogoutall" style="align-self:flex-start">${t('logoutAll')}</button>
      <div class="row end"><button class="btn" data-close>${t('close')}</button><button class="btn pri" id="mlogout">${t('signOut')}</button></div>`, () => {
    $$('#mlang [data-l]').forEach(b => b.onclick = async () => { setLang(b.dataset.l); closeSheet(); try { await api('PATCH', '/api/auth/me', { lang: LANG }); } catch { /* keep local */ } render(); });
    $('#msnd').onchange = e => { S.sound = e.target.checked; ls.set('sound', S.sound); if (S.sound) { chime(); toast(t('soundOn')); } else toast(t('soundOff')); closeSheet(); render(); };
    $('#mlogout').onclick = () => { closeSheet(); signOut(); };
    $('#mlogoutall').onclick = () => sheet(`<h2>${t('logoutAllQ')}</h2><p>${t('logoutAllMe')}</p><div class="row end"><button class="btn" data-close>${t('no')}</button><button class="btn pri danger" id="la-go">${t('logoutAll')}</button></div>`, () => {
      $('#la-go').onclick = async () => { stopPolling(); try { await api('POST', '/api/auth/logout-all', {}); } catch { /* ignore */ } closeSheet(); S.me = null; loginView(t('loggedOutAll')); };
    });
  });
  $$('[data-tab]').forEach(b => b.onclick = () => { S.tab = b.dataset.tab; ls.set('tab', S.tab); render(); });
  $$('#lang [data-l]').forEach(b => b.onclick = async () => { setLang(b.dataset.l); try { await api('PATCH', '/api/auth/me', { lang: LANG }); } catch { /* keep local */ } render(); });
  $('#snd').onchange = e => { S.sound = e.target.checked; ls.set('sound', S.sound); if (S.sound) { chime(); toast(t('soundOn')); } else toast(t('soundOff')); };

  renderOffline();
  ({ list: listView, rest: restView, users: usersView, log: logView })[S.tab]();
}
async function signOut() { stopPolling(); try { await api('POST', '/api/auth/logout', {}); } catch { /* ignore */ } S.me = null; loginView(); }
function renderOffline() { const el = $('#offline'); if (el) el.innerHTML = online ? '' : `<p class="offline">${t('offline')}</p>`; }
function refresh() { if (!S.me) return; if (sheetOpen()) { pendingReload = true; return; } if (S.tab === 'list') listView(); }

/* ============ polling and chime ============ */
let pollTimer = null, audioCtx = null, lastUnseen = null;
function startPolling() { stopPolling(); poll(true); pollTimer = setInterval(() => { if (document.visibilityState === 'visible') poll(); }, 15000); }
function stopPolling() { if (pollTimer) clearInterval(pollTimer); pollTimer = null; lastUnseen = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.me) poll(); });
async function poll(first) {
  if (!S.me) return;
  let s;
  try { s = await api('GET', '/api/bookings/summary', undefined, { background: true, quiet: true }); } catch { return; }
  const changed = s.version !== S.summary.version;
  applySummary(s);
  if (!first && changed) refresh();
}
/** Update the badge and title; chime when a booking id appears that was not unseen before. */
function applySummary(s) {
  const ids = new Set(s.unseen.map(b => b.id));
  if (lastUnseen) {
    const fresh = [...ids].filter(id => !lastUnseen.has(id));
    if (fresh.length) { if (S.sound) chime(); if ('vibrate' in navigator) try { navigator.vibrate(200); } catch { /* ignore */ } }
  }
  lastUnseen = ids;
  S.summary = s;
  document.title = (s.pending ? `(${s.pending}) ` : '') + 'Saigon Taste Booking';
  const tb = $('[data-tab="list"]'); if (tb) tb.innerHTML = `${icon('list')}<span class="tl">${t('tBookings')}</span>${s.pending ? `<span class="badge">${s.pending}</span>` : ''}`;
  const ms = $('#mseg-p'); if (ms) ms.textContent = `${t('mPending')} · ${s.pending}`;
}
['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { unlockAudio(); }, { passive: true }));
function unlockAudio() { if (!S.sound) return; try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch { /* no audio */ } }
function chime() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime;
    [880, 1320].forEach((f, i) => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0 + i * .18); g.gain.exponentialRampToValueAtTime(.25, t0 + i * .18 + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + i * .18 + .4); o.connect(g); g.connect(audioCtx.destination); o.start(t0 + i * .18); o.stop(t0 + i * .18 + .45); });
  } catch { /* no audio */ }
}

/* ============ bookings ============ */
function guestChips(b) {
  const g = b.guest || { seated: 0, noshow: 0 }, c = [];
  if (g.seated >= 2) c.push(`<span class="chip st-confirmed">${t('regular', { n: g.seated })}</span>`);
  else if (g.seated === 1) c.push(`<span class="chip st-cancelled">${t('visit1')}</span>`);
  if (g.noshow) c.push(`<span class="chip st-noshow">${t('noshows', { n: g.noshow })}</span>`);
  return c.length ? `<div class="chips">${c.join('')}</div>` : '';
}
function card(b, showDate) {
  const r = rest(b.restaurantId);
  const wait = Date.now() - b.createdAt;
  const late = b.status === 'pending' && (b.remindedAt || wait > 30 * 60000);
  const act = (a, cls = '') => `<button class="btn sm ${cls}" data-act="${a}" data-id="${b.id}">${t(a)}</button>`;
  const acts = { pending: act('confirm', 'pri') + act('decline'), confirmed: act('seated') + act('noshow') + act('cancel', 'dang'), seated: act('undo', 'ghost'), noshow: act('undo', 'ghost') }[b.status] || '';
  return `<div class="bk${!b.seen ? ' fresh' : ''}"><div class="t">${esc(b.time)}${showDate ? `<small>${dayShort(b.date)}</small>` : ''}</div><div class="main">
    <div class="nm">${esc(b.name)} <span class="muted" style="font-weight:600">· ${b.party} ${t('guests')}</span>${!b.seen ? `<span class="chip new">${t('newChip')}</span>` : ''}<span class="chip st-${b.status}">${t('st_' + b.status)}</span>${late ? `<span class="chip late">⏱ ${t('waitFor', { d: dur(wait) })}</span>` : ''}${S.restaurants.length > 1 ? `<span class="rtag" style="--rc:${esc(r.color)}">${esc(r.name)}</span>` : ''}</div>
    <div class="meta"><a class="copy tel" href="tel:${esc(b.phone)}">${icon('phone', 13)} ${esc(b.phoneFmt)}</a>${b.email ? `<span class="copy">${esc(b.email)}</span>` : ''}<span>${b.source === 'staff' ? t('byStaff') : b.source === 'hosted' ? t('hosted') : t('web')} · ${ago(b.createdAt)}</span></div>
    ${guestChips(b)}
    ${b.note ? `<div class="req">${esc(b.note)}</div>` : ''}
    ${b.status === 'declined' && b.declineReason ? `<div class="meta">${t('decline')}: ${esc(b.declineReason)}</div>` : ''}${b.status === 'cancelled' && b.cancelReason ? `<div class="meta">${t('cancel')}: ${esc(b.cancelReason)}</div>` : ''}
    <div class="acts">${acts}<button class="btn sm ghost" data-act="details" data-id="${b.id}">${t('details')}</button></div></div></div>`;
}
const mview = () => S.mview || (S.pending.length ? 'pending' : 'day');
async function listView() {
  const pane = $('#pane'); if (!pane) return;
  const q = `restaurant=${S.rid}`;
  let pend, day, sum, load;
  try { [pend, day, sum, load] = await Promise.all([api('GET', `/api/bookings/pending?${q}`), api('GET', `/api/bookings?date=${S.date}&${q}`), api('GET', '/api/bookings/summary', undefined, { background: true }), api('GET', `/api/bookings/load?date=${S.date}&${q}`)]); } catch { return; }
  S.pending = pend.bookings; S.day = day.bookings; applySummary(sum);
  if (S.tab !== 'list' || !$('#pane')) return;
  const tz = rest(S.rid === 'all' ? (S.restaurants[0] || {}).id : +S.rid).timezone, today = todayIn(tz);
  const unseen = S.summary.unseen || [];
  const counts = {}; S.day.forEach(b => { counts[b.status] = (counts[b.status] || 0) + 1; });
  const shown = S.day.filter(b => S.status === 'all' || b.status === S.status);
  const live = S.day.filter(b => !['declined', 'cancelled', 'expired'].includes(b.status));
  const guests = S.day.filter(b => ['pending', 'confirmed', 'seated'].includes(b.status)).reduce((a, b) => a + b.party, 0);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  pane.innerHTML = `<div class="stack">
    ${!standalone && !ls.get('pwaHintDone', false) ? `<div class="panel hint"><div style="min-width:0;flex:1"><b>${t('pwaTitle')}</b><p class="muted small">${t('pwaText')}</p></div><button class="btn sm" id="hintok">${t('gotIt')}</button></div>` : ''}
    ${unseen.length ? `<div class="alert" role="status"><span class="bell" aria-hidden="true">🔔</span><div style="min-width:0;flex:1"><b>${t('newArrived', { n: unseen.length })}</b><div class="muted small">${unseen.slice(0, 3).map(b => `${esc(b.name)} · ${b.party} · ${esc(b.time)} ${dayShort(b.date)}${S.restaurants.length > 1 ? ' · ' + esc(rest(b.restaurantId).name) : ''}`).join('<br>')}${unseen.length > 3 ? `<br>${t('andMore', { n: unseen.length - 3 })}` : ''}</div></div><button class="btn sm" id="seen">${t('markSeen')}</button></div>` : ''}
    <div class="seg mseg" role="group"><button id="mseg-p" data-mv="pending" aria-pressed="${mview() === 'pending'}">${t('mPending')} · ${S.pending.length}</button><button data-mv="day" aria-pressed="${mview() === 'day'}">${t('mDay')}</button></div>
    <div class="grid-app" data-show="${mview()}">
      <section class="panel p-pending ${S.pending.length ? 'pending' : ''}"><h2>${t('waiting')} · ${S.pending.length}</h2>
        ${S.pending.length ? `<div class="list">${S.pending.map(b => card(b, true)).join('')}</div>` : `<p class="muted">${t('nothingWaiting')}</p>`}</section>
      <section class="panel stack p-day" style="gap:12px">
        <div class="filters">
          <div class="datenav"><button class="btn sm" id="dprev" aria-label="${t('prevDay')}">‹</button><input type="date" id="dpick" value="${S.date}" aria-label="${t('date')}"><button class="btn sm" id="dnext" aria-label="${t('nextDay')}">›</button>${S.date !== today ? `<button class="btn sm ghost" id="dtoday">${t('today')}</button>` : ''}</div>
          ${S.restaurants.length > 1 ? `<select id="rsel" style="width:auto" aria-label="${t('restaurant')}"><option value="all">${t('allRest')}</option>${S.restaurants.map(r => `<option value="${r.id}" ${String(S.rid) === String(r.id) ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>` : ''}
          <div class="row fil-end"><a class="btn sm" href="/print?date=${S.date}&restaurant=${S.rid}">${t('print')}</a><button class="btn sm pri desk" id="add">${t('add')}</button></div>
        </div>
        <h2 style="font-size:15px">${dayFull(S.date)}${S.date === today ? t('todaySuffix') : ''}</h2>
        <div class="stats"><div class="stat"><b>${live.length}</b><span>${t('bookingsN')}</span></div><div class="stat"><b>${guests}</b><span>${t('guestsExp')}</span></div><div class="stat"><b>${counts.pending || 0}</b><span>${t('pendingN')}</span></div></div>
        ${loadHtml(load)}
        <div class="pills">${[['all', S.day.length], ...['pending', 'confirmed', 'seated', 'noshow', 'declined', 'cancelled', 'expired'].map(k => [k, counts[k] || 0])].filter(x => x[0] === 'all' || x[1]).map(([k, n]) => `<button class="pill" data-st="${k}" aria-pressed="${S.status === k}">${k === 'all' ? t('all') : t('st_' + k)} ${n}</button>`).join('')}</div>
        ${shown.length ? `<div class="list">${shown.map(b => card(b, false)).join('')}</div>` : `<p class="empty">${t('noneDay')}</p>`}
      </section></div></div>
    <button class="fab" id="fab" aria-label="${t('add')}">${icon('plus', 26)}</button>`;
  $$('[data-mv]').forEach(b => b.onclick = () => { S.mview = b.dataset.mv; listView(); window.scrollTo(0, 0); });
  $('#fab').onclick = addSheet;
  const go = d => { S.date = d; listView(); };
  $('#dprev').onclick = () => go(addDays(S.date, -1)); $('#dnext').onclick = () => go(addDays(S.date, 1));
  $('#dpick').onchange = e => e.target.value && go(e.target.value);
  const dt = $('#dtoday'); if (dt) dt.onclick = () => go(today);
  const rs = $('#rsel'); if (rs) rs.onchange = e => { S.rid = e.target.value; listView(); };
  const hk = $('#hintok'); if (hk) hk.onclick = () => { ls.set('pwaHintDone', true); listView(); };
  const sn = $('#seen'); if (sn) sn.onclick = async () => { await api('POST', '/api/bookings/seen', { ids: unseen.map(b => b.id) }); listView(); };
  $$('[data-st]').forEach(b => b.onclick = () => { S.status = b.dataset.st; listView(); });
  $('#add').onclick = addSheet;
  pane.onclick = e => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act, +b.dataset.id); };
}
function loadHtml(load) {
  const rows = (load.restaurants || []).filter(x => x.slots.some(s => s.guests > 0));
  if (!rows.length) return '';
  return `<div class="load"><h3 class="sec">${t('loadTitle')}</h3>${rows.map(x => {
    const r = rest(x.restaurantId);
    return `<div class="loadrow">${S.restaurants.length > 1 ? `<span class="rtag" style="--rc:${esc(r.color)}">${esc(r.name)}</span>` : ''}<div class="loadslots">${x.slots.filter(s => s.guests > 0).map(s => {
      const lvl = x.cap ? (s.guests > x.cap ? 'over' : s.guests >= x.cap * 0.8 ? 'high' : '') : '';
      return `<span class="ls ${lvl}"><b class="mono">${s.time}</b> ${s.guests}${x.cap ? '/' + x.cap : ''}</span>`;
    }).join('')}</div></div>`;
  }).join('')}</div>`;
}
const findB = id => S.pending.find(b => b.id === id) || S.day.find(b => b.id === id);
const addMin = (hhmm, m) => { const [h, mi] = hhmm.split(':').map(Number); const x = h * 60 + mi + m; return pad(Math.floor(x / 60) % 24) + ':' + pad(x % 60); };
async function loadAt(rid, date, time, party, ignore) {
  try { const d = await api('GET', `/api/bookings/load?restaurant=${rid}&date=${date}&time=${encodeURIComponent(time)}&party=${party}${ignore ? '&ignore=' + ignore : ''}`, undefined, { quiet: true }); return d.restaurants[0]; } catch { return null; }
}
function summaryHtml(b) { const r = rest(b.restaurantId); return `<p><b>${esc(b.name)}</b> · ${b.party} ${t('guests')} · <span class="mono">${esc(b.time)}</span> ${dayShort(b.date)}<br><span class="muted">${esc(r.name)} · ${esc(b.phoneFmt)} · ${t('ref')} ${esc(b.ref)}</span></p>${guestChips(b)}`; }
function mailBlock(m) {
  return `<div class="mailhead"><span>From</span><b>${esc(m.from)}</b><span>To</span><b>${esc(m.to)}</b>${m.replyTo ? `<span>Reply-to</span><b>${esc(m.replyTo)}</b>` : ''}<span>Subject</span><b>${esc(m.subject)}</b></div><iframe class="mailframe" sandbox title="Email"></iframe>`;
}
function fillFrame(s, html) { const f = s.querySelector('.mailframe'); if (f) f.srcdoc = html; }
async function doAction(b, action, body = {}) {
  try {
    const r = await api('POST', `/api/bookings/${b.id}/${action}`, body);
    closeSheet(); return r.booking;
  } catch (e) {
    if (e.status === 409) { closeSheet(); toast(t('changed')); listView(); }
    else if (e.data && e.data.error === 'reason') toast(t('needReason'));
    return null;
  }
}
async function act(kind, id) {
  const b = findB(id); if (!b) return;
  if (kind === 'confirm') {
    let pv = null;
    if (b.email) { try { pv = await api('POST', `/api/bookings/${b.id}/preview`, { kind: 'confirm' }); } catch { return; } }
    const ld = await loadAt(b.restaurantId, b.date, b.time, 0);
    const ldHtml = ld ? (ld.cap && ld.peak > ld.cap ? `<p class="note bad">${t('loadOver', { a: b.time, b: addMin(b.time, ld.stayHere), n: ld.peak, c: ld.cap })}</p>` : `<p class="note">${t('loadNow', { a: b.time, b: addMin(b.time, ld.stayHere), n: ld.peak, c: ld.cap ? '/' + ld.cap : '' })}</p>`) : '';
    sheet(`<h2>${t('confirmTitle')}</h2>${summaryHtml(b)}${ldHtml}${pv ? `${pv.ownMailbox ? '' : `<p class="note warn">${t('fallbackWarn')}</p>`}<p class="muted small">${t('guestGets')}</p>${mailBlock(pv)}` : `<p class="note">${t('noEmail')}</p>`}
      <div class="row end"><button class="btn" data-close>${t('no')}</button><button class="btn pri" id="go">${b.email ? t('confirmSend') : t('confirm')}</button></div>`, s => {
      if (pv) fillFrame(s, pv.html);
      $('#go').onclick = async e => { e.target.disabled = true; const nb = await doAction(b, 'confirm'); if (nb) { toast(b.email ? t('confirmed', { e: b.email }) : t('confirmedNoMail')); listView(); } else e.target.disabled = false; };
    });
  } else if (kind === 'decline') {
    sheet(`<h2>${t('declineTitle')}</h2>${summaryHtml(b)}<label class="f" for="dr">${t('reasonGuest')}<textarea id="dr" rows="2" maxlength="250" placeholder="${esc(t('reasonPh'))}"></textarea></label>
      <div class="row end"><button class="btn" data-close>${t('no')}</button><button class="btn pri" id="pv">${b.email ? t('previewMail') : t('decline')}</button></div>`, () => {
      $('#pv').onclick = async () => {
        const reason = $('#dr').value.trim();
        if (!b.email) { const nb = await doAction(b, 'decline', { reason }); if (nb) { toast(t('declined')); listView(); } return; }
        let pv; try { pv = await api('POST', `/api/bookings/${b.id}/preview`, { kind: 'decline', reason }); } catch { return; }
        sheet(`<h2>${t('declineTitle')}</h2>${pv.ownMailbox ? '' : `<p class="note warn">${t('fallbackWarn')}</p>`}${mailBlock(pv)}<div class="row end"><button class="btn" data-close>${t('no')}</button><button class="btn pri" id="go">${t('declineSend')}</button></div>`, s => {
          fillFrame(s, pv.html);
          $('#go').onclick = async e => { e.target.disabled = true; const nb = await doAction(b, 'decline', { reason }); if (nb) { toast(t('declined')); listView(); } else e.target.disabled = false; };
        });
      };
    });
  } else if (kind === 'cancel') {
    sheet(`<h2>${t('cancelTitle')}</h2>${summaryHtml(b)}<label class="f" for="cr">${t('reasonInternal')}<textarea id="cr" rows="2" maxlength="250"></textarea></label><span class="err" id="cerr"></span>
      <div class="row end"><button class="btn" data-close>${t('no')}</button><button class="btn pri" id="go">${t('cancelTitle')}</button></div>`, () => {
      $('#go').onclick = async () => { const reason = $('#cr').value.trim(); if (!reason) { $('#cerr').textContent = t('needReason'); return; } const nb = await doAction(b, 'cancel', { reason }); if (nb) { toast(t('cancelled')); listView(); } };
    });
  } else if (kind === 'seated' || kind === 'noshow' || kind === 'undo') {
    const nb = await doAction(b, kind);
    if (nb) { toast(kind === 'undo' ? t('undone') : t(kind === 'seated' ? 'markedSeated' : 'markedNoshow', { n: b.name })); listView(); }
  } else if (kind === 'details') detailSheet(b.id);
}
async function detailSheet(id) {
  let d; try { d = await api('GET', `/api/bookings/${id}`); } catch { return; }
  const b = d.booking;
  const actor = a => (a === 'guest' ? t('guest_') : a === 'system' ? t('system_') : esc(a));
  sheet(`<h2>Booking ${esc(b.ref)}</h2>${summaryHtml(b)}<p><span class="chip st-${b.status}">${t('st_' + b.status)}</span></p>
    ${b.email ? `<p class="small"><span class="copy">${esc(b.email)}</span></p>` : ''}
    ${b.note ? `<div class="req">${t('requests')}: ${esc(b.note)}</div>` : ''}
    <div><h3 class="sec">${t('hist')}</h3><ul class="hist">${d.events.map(e => `<li><span class="mono">${stamp(e.at)}</span> · ${esc(t('ev_' + e.kind, { d: e.detail }))}${e.detail && !/^email_|reminded/.test(e.kind) ? ` · ${esc(e.detail)}` : ''}<br><span class="muted">${actor(e.actor)}</span></li>`).join('')}</ul></div>
    ${d.history.length ? `<div><h3 class="sec">${t('otherBookings')}</h3><ul class="hist">${d.history.map(x => `<li><span class="mono">${dayShort(x.date)} ${esc(x.time)}</span> · ${esc(rest(x.restaurantId).name)} · ${x.party} ${t('guests')} <span class="chip st-${x.status}">${t('st_' + x.status)}</span></li>`).join('')}</ul></div>` : ''}
    ${d.emails.length ? `<div><h3 class="sec">${t('emailsSent')}</h3><ul class="hist">${d.emails.map(m => `<li><button class="linkbtn" data-mail="${m.id}">${esc(m.subject)}</button><br><span class="muted">${esc(m.to)} · ${stamp(m.at)} · ${t('em_' + m.status)}${m.via && t('via_' + m.via) ? ' · ' + t('via_' + m.via) : ''}${m.error && m.status !== 'sent' ? ' · ' + esc(m.error) : ''}</span></li>`).join('')}</ul></div>` : ''}
    <div class="row end">${isOwner() || b.status === 'pending' ? `<button class="btn dang" id="delb" style="margin-right:auto">${t('del')}</button>` : ''}<button class="btn" data-close>${t('close')}</button></div>`, () => {
    const db = $('#delb'); if (db) db.onclick = () => deleteSheet(b);
    $$('[data-mail]').forEach(x => x.onclick = async () => {
      let m; try { m = await api('GET', `/api/emails/${x.dataset.mail}`); } catch { return; }
      sheet(`<h2>${t('emailView')}</h2>${mailBlock({ from: m.from, to: m.to, replyTo: m.replyTo, subject: m.subject })}<p class="muted small">${t('em_' + m.status)}${m.error && m.status !== 'sent' ? ' · ' + esc(m.error) : ''}</p><div class="row end"><button class="btn" id="bk">${t('back')}</button><button class="btn" data-close>${t('close')}</button></div>`, s => { fillFrame(s, m.html); $('#bk').onclick = () => detailSheet(id); });
    });
  });
  if (!b.seen) { api('POST', '/api/bookings/seen', { ids: [b.id] }).then(() => poll(true)).catch(() => {}); }
}
function deleteSheet(b) {
  sheet(`<h2>${t('delTitle')}</h2>${summaryHtml(b)}<p class="note bad">${t('delText')}</p>${['confirmed', 'seated'].includes(b.status) ? `<p class="note warn">${t('delConfirmedWarn')}</p>` : ''}
    <label class="f" for="delr">${t('delReason')}<input id="delr" maxlength="200"></label>
    <div class="row end"><button class="btn" data-close>${t('no')}</button><button class="btn pri danger" id="delgo">${t('delGo')}</button></div>`, () => {
    $('#delgo').onclick = async e => {
      e.target.disabled = true;
      try { await api('DELETE', `/api/bookings/${b.id}`, { reason: $('#delr').value.trim() }); closeSheet(); toast(t('deleted')); listView(); }
      catch (err) { if (err.status === 409 || err.status === 404) { closeSheet(); toast(t('changed')); listView(); } else if (e.target.isConnected) e.target.disabled = false; }
    };
  });
}
function addSheet() {
  const rids = S.restaurants.map(r => r.id);
  const D = { restaurantId: S.rid !== 'all' ? +S.rid : rids[0], date: S.date, time: '12:00', party: 2, name: '', phone: '', email: '', note: '', override: false, sendEmail: true };
  let known = null;
  const draw = (E = {}) => {
    const r = rest(D.restaurantId);
    const err = k => (E[k] ? `<span class="err">${esc(errText(k, E[k]))}</span>` : '');
    sheet(`<h2>${t('addTitle')}</h2>
      <div class="g2">${rids.length > 1 ? `<label class="f" for="a-r">${t('restaurant')}<select id="a-r">${rids.map(id => `<option value="${id}" ${D.restaurantId === id ? 'selected' : ''}>${esc(rest(id).name)}</option>`).join('')}</select></label>` : ''}
        <label class="f" for="a-p">${t('guestsLbl')}<input id="a-p" type="number" inputmode="numeric" min="1" max="99" value="${esc(D.party)}">${err('party')}</label></div>
      <div class="g2"><label class="f" for="a-d">${t('date')}<input id="a-d" type="date" value="${esc(D.date)}"></label><label class="f" for="a-t">${t('time', { c: r.timezone.split('/')[1] })}<input id="a-t" type="time" step="900" value="${esc(D.time)}"></label></div>
      ${err('time')}
      <div class="g2"><label class="f" for="a-ph">${t('phone')}<input id="a-ph" type="tel" inputmode="tel" placeholder="0412 345 678" value="${esc(D.phone)}">${err('phone')}</label>
        <label class="f" for="a-n">${t('guestName')}<input id="a-n" value="${esc(D.name)}" maxlength="120">${err('name')}</label></div>
      <p id="a-load" class="note" hidden></p>
      ${known && known.length ? `<p class="note">${t('guestKnown', { n: known.length, s: known.filter(x => x.status === 'seated').length, x: known.filter(x => x.status === 'noshow').length })}</p>` : ''}
      <label class="f" for="a-e">${t('guestEmail')}<input id="a-e" type="email" value="${esc(D.email)}" maxlength="190">${err('email')}</label>
      <label class="f" for="a-no">${t('reqLbl')}<textarea id="a-no" rows="2" maxlength="500">${esc(D.note)}</textarea></label>
      ${isOwner() ? `<label class="check" for="a-ov"><input id="a-ov" type="checkbox" ${D.override ? 'checked' : ''}> ${t('override')}</label>` : ''}
      <label class="check" for="a-s"><input id="a-s" type="checkbox" ${D.sendEmail ? 'checked' : ''}> ${t('sendConfirm')}</label>
      ${E.dup ? `<p class="err">${esc(errText('dup', E.dup))}</p>` : ''}
      <div class="row end"><button class="btn" data-close>${t('no')}</button><button class="btn pri" id="a-go">${t('saveConfirmed')}</button></div>`, () => {
      const keep = () => { const g = s => $(s); if (g('#a-r')) D.restaurantId = +g('#a-r').value; D.party = g('#a-p').value; D.date = g('#a-d').value; D.time = g('#a-t').value; D.name = g('#a-n').value; D.phone = g('#a-ph').value; D.email = g('#a-e').value; D.note = g('#a-no').value; D.override = !!(g('#a-ov') && g('#a-ov').checked); D.sendEmail = g('#a-s').checked; };
      const ar = $('#a-r'); if (ar) ar.onchange = () => { keep(); draw(); };
      const showLoad = async () => {
        keep(); const el = $('#a-load'); if (!el) return;
        const party = parseInt(D.party, 10) || 0;
        if (!D.date || !D.time || !party) { el.hidden = true; return; }
        const ld = await loadAt(D.restaurantId, D.date, D.time, party);
        if (!ld || !$('#a-load')) return;
        const m = ld.peak + party, over = ld.cap && m > ld.cap, v = { a: D.time, b: addMin(D.time, ld.stayHere), n: ld.peak, m, c: ld.cap ? '/' + ld.cap : '' };
        el.className = over ? 'note bad' : 'note';
        el.textContent = over ? t('loadAddOver', { ...v, c: ld.cap }) + (isOwner() ? t('loadNeedOverride') : t('loadStaffOver')) : t('loadAdd', v);
        el.hidden = false;
      };
      ['#a-d', '#a-t', '#a-p'].forEach(sel => $(sel).addEventListener('change', showLoad));
      showLoad();
      $('#a-ph').onchange = async () => {
        keep();
        try { const g = await api('GET', '/api/bookings/guest?phone=' + encodeURIComponent(D.phone)); known = g.bookings; if (known.length) { if (!D.name) D.name = known[0].name; if (!D.email) D.email = known[0].email; } draw(); $('#a-n').focus(); } catch { /* ignore */ }
      };
      $('#a-go').onclick = async e => {
        keep(); e.target.disabled = true;
        try {
          const r = await api('POST', '/api/bookings', { ...D });
          closeSheet(); toast(t('added')); S.date = r.booking.date; listView();
        } catch (err) { if (err.status === 422) draw(err.data.errors || {}); else if (e.target.isConnected) e.target.disabled = false; }
      };
    });
  };
  draw();
}

/* ============ print page ============ */
async function printPage() {
  const q = new URLSearchParams(location.search);
  const date = q.get('date') || todayIn('Australia/Melbourne'), rid = q.get('restaurant') || 'all';
  let d; try { d = await api('GET', `/api/bookings?date=${encodeURIComponent(date)}&restaurant=${encodeURIComponent(rid)}`); } catch { return; }
  const rows = d.bookings.filter(b => !['declined', 'cancelled', 'expired'].includes(b.status));
  document.body.classList.add('print');
  $('#root').innerHTML = `<div class="print"><div class="wrap">
    <div class="noprint row"><a class="btn" href="/">‹ ${t('back')}</a><button class="btn pri" id="pr">${t('printBtn')}</button><a class="btn" id="csv" href="/api/bookings/export.csv?date=${encodeURIComponent(date)}&restaurant=${encodeURIComponent(rid)}">${t('csv')}</a></div>
    <h1>${t('printTitle')} · ${dayFull(date)}</h1><p>${rid === 'all' ? t('allRest') : esc(rest(+rid).name)} · ${rows.length} ${t('bookingsN').toLowerCase()} · ${rows.reduce((a, b) => a + b.party, 0)} ${t('guests')}</p>
    <table><thead><tr><th>${t('time', { c: '' }).replace(' ()', '')}</th><th>${t('guest')}</th><th>${t('pax')}</th>${S.restaurants.length > 1 ? `<th>${t('venue')}</th>` : ''}<th>${t('requests')}</th></tr></thead><tbody>
    ${rows.length ? rows.map(b => `<tr><td class="mono"><b>${esc(b.time)}</b></td><td><b>${esc(b.name)}</b><br><span class="mono">${esc(b.phoneFmt)}</span>${b.status === 'pending' ? `<br><i>${t('notConfirmed')}</i>` : ''}</td><td class="mono">${b.party}</td>${S.restaurants.length > 1 ? `<td>${esc(rest(b.restaurantId).name)}</td>` : ''}<td>${esc(b.note)}${b.guest && b.guest.seated >= 2 ? `<br><i>${t('regular', { n: b.guest.seated })}</i>` : ''}</td></tr>`).join('') : `<tr><td colspan="5">${t('noneDay')}</td></tr>`}
    </tbody><tfoot><tr><td colspan="2">${t('total')}</td><td class="mono">${rows.reduce((a, b) => a + b.party, 0)}</td><td colspan="2"></td></tr></tfoot></table></div></div>`;
  $('#pr').onclick = () => { api('POST', '/api/bookings/printed', { date }).catch(() => {}); window.print(); };
}

/* ============ restaurants (owner) ============ */
let RS = null; // { restaurants, colors, timezones, encryption, systemMail }
async function restView(selectId) {
  try { RS = await api('GET', '/api/restaurants'); } catch { return; }
  if (S.tab !== 'rest') return;
  S.restaurants = RS.restaurants.map(r => ({ id: r.id, name: r.name, color: r.color, timezone: r.timezone, online: r.online, slug: r.slug }));
  const id = selectId || (RS.restaurants.some(r => r.id === S.setR) ? S.setR : (RS.restaurants[0] || {}).id);
  S.setR = id;
  const r = RS.restaurants.find(x => x.id === id);
  const pane = $('#pane');
  if (!r) { pane.innerHTML = `<div class="pills"><button class="btn sm" id="addr">${t('addRest')}</button></div>`; $('#addr').onclick = addRestaurant; return; }
  const R = r.rules;
  const sel = (id2, val, opts) => `<select id="${id2}">${opts.map(v => `<option value="${v}" ${val === v ? 'selected' : ''}>${mins(v)}</option>`).join('')}</select>`;
  const mailState = r.mail.status === 'ok' ? `<p class="note ok">✓ ${t('mail_ok')}</p>` : r.mail.status === 'failed' ? `<p class="note bad">${esc(t('mail_failed', { e: r.mail.error }))}</p>` : `<p class="note warn">${t('mail_none')}</p>`;
  const appUrl = location.origin;
  pane.innerHTML = `<div class="stack">
    <div class="pills">${RS.restaurants.map(x => `<button class="pill" data-sr="${x.id}" aria-pressed="${x.id === id}">${esc(x.name)}${x.online ? '' : t('paused')}</button>`).join('')}<button class="btn sm" id="addr">${t('addRest')}</button></div>
    <form id="rf" class="grid-app" novalidate>
    <div class="stack">
      <section class="panel stack" style="gap:10px"><h2 class="h" style="margin:0">${t('details_')}</h2>
        <label class="check" for="s-on"><input id="s-on" type="checkbox" ${r.online ? 'checked' : ''}> <b>${t('online')}</b></label>
        <div class="g2"><label class="f" for="s-name">${t('name')}<input id="s-name" value="${esc(r.name)}" maxlength="120"><span class="err" data-e="name"></span></label>
          <label class="f" for="s-dom">${t('website')}<input id="s-dom" value="${esc(r.domain)}" placeholder="restaurant.com.au"></label></div>
        <div class="f" style="font-size:12px;font-weight:600;color:var(--muted);display:flex;flex-direction:column;gap:6px">${t('labelColor')}<div class="swatches" id="sw">${RS.colors.map(c => `<button type="button" data-c="${c}" style="--sw:${c}" aria-label="${c}" aria-pressed="${r.color === c}"></button>`).join('')}</div></div>
        <div class="g2"><label class="f" for="s-tz">${t('tz')}<select id="s-tz">${RS.timezones.map(z => `<option ${z === r.timezone ? 'selected' : ''}>${z}</option>`).join('')}</select></label>
          <label class="f" for="s-ph">${t('restPhone')}<input id="s-ph" type="tel" value="${esc(r.phoneFmt)}"><span class="err" data-e="phone"></span></label></div>
        <label class="f" for="s-em">${t('restEmail')}<input id="s-em" type="email" value="${esc(r.email)}"><span class="err" data-e="email"></span></label>
        <label class="f" for="s-ad">${t('address')}<input id="s-ad" value="${esc(r.address)}"></label>
        <label class="f" for="s-ex">${t('extraNote')}<textarea id="s-ex" rows="2" maxlength="600">${esc(r.extraNote)}</textarea></label>
        <label class="f" for="s-pr">${t('privacy')}<input id="s-pr" value="${esc(r.privacyUrl)}" placeholder="https://"><span class="err" data-e="privacyUrl"></span></label>
      </section>
      <section class="panel stack" style="gap:10px"><h2 class="h" style="margin:0">${t('rules')}</h2>
        <div class="g2">
          <label class="f" for="s-int">${t('r_interval')}${sel('s-int', R.interval, [15, 30])}</label>
          <label class="f" for="s-lb">${t('r_lastBefore')}${sel('s-lb', R.lastBefore, [0, 30, 45, 60, 90, 120])}</label>
          <label class="f" for="s-lead">${t('r_lead')}${sel('s-lead', R.lead, [0, 30, 60, 120, 180, 240, 1440])}</label>
          <label class="f" for="s-max">${t('r_maxDays')}<input id="s-max" type="number" min="1" max="365" value="${R.maxDays}"></label>
          <label class="f" for="s-mp">${t('r_maxParty')}<input id="s-mp" type="number" min="1" max="50" value="${R.maxParty}"></label>
          <label class="f" for="s-cap">${t('r_cap')}<input id="s-cap" type="number" min="0" max="1000" value="${R.cap}"></label>
          <label class="f" for="s-stay">${t('r_stay')}${sel('s-stay', R.stay, [30, 45, 60, 75, 90, 105, 120, 150, 180])}</label>
          <label class="f" for="s-stayE">${t('r_stayEvening')}${sel('s-stayE', R.stayEvening, [30, 45, 60, 75, 90, 105, 120, 150, 180])}</label>
          <label class="f" for="s-rm">${t('r_remind')}${sel('s-rm', R.remind, [0, 15, 30, 60, 120])}</label>
        </div><p class="muted small">${t('capNote')} ${t('expireNote')}</p></section>
      <section class="panel stack" style="gap:10px"><h2 class="h" style="margin:0">${t('mailTitle')}</h2>
        ${mailState}<p class="muted small">${t('mailHelp')}</p>
        ${RS.encryption ? '' : `<p class="note bad">${t('noEncKey')}</p>`}
        <label class="f" for="m-name">${t('fromName')}<input id="m-name" value="${esc(r.mail.fromName)}" placeholder="${esc(r.name)}"></label>
        <div class="g2"><label class="f" for="m-host">${t('smtpHost')}<input id="m-host" value="${esc(r.mail.host)}" placeholder="mail.${esc(r.domain || 'restaurant.com.au')}" autocapitalize="off"><span class="err" data-e="mailHost"></span></label>
          <label class="f" for="m-port">${t('smtpPort')}<select id="m-port"><option ${r.mail.port === 465 ? 'selected' : ''}>465</option><option ${r.mail.port === 587 ? 'selected' : ''}>587</option></select></label></div>
        <label class="f" for="m-user">${t('smtpUser')}<input id="m-user" type="email" value="${esc(r.mail.user)}" placeholder="bookings@${esc(r.domain || 'restaurant.com.au')}" autocomplete="off"><span class="err" data-e="mailUser"></span></label>
        <label class="f" for="m-pass">${t('smtpPass')}<input id="m-pass" type="password" autocomplete="new-password" placeholder="${r.mail.passSet ? '••••••••' : ''}"><span class="err" data-e="mailPass"></span></label>
        ${r.mail.passSet ? `<p class="muted small">${t('passSet')}</p><label class="check" for="m-clear"><input id="m-clear" type="checkbox"> ${t('clearPass')}</label>` : ''}
        <div class="row"><label class="f" for="m-to" style="flex:1">${t('testTo')}<input id="m-to" type="email" value="${esc(S.me.user.email)}"></label><button class="btn" type="button" id="mtest" style="align-self:flex-end">${t('sendTest')}</button></div>
        <p id="mres" class="small"></p>
      </section>
      <section class="panel stack" style="gap:10px"><h2 class="h" style="margin:0">${t('connTitle')}</h2>
        <p class="muted small">${r.domain ? esc(t('connWp', { d: r.domain })) : t('connNoSite')}</p>
        <dl class="kv"><dt>${t('appAddr')}</dt><dd><span class="copy">${esc(appUrl)}</span></dd><dt>${t('keyNow')}</dt><dd><span class="copy">${esc(r.keyPrefix)}••••••••</span> <button class="btn sm" type="button" id="newkey">${t('newKey')}</button></dd>
        <dt>${t('hostedPage')}</dt><dd><a class="copy" href="/book/${esc(r.slug)}" target="_blank" rel="noopener">${esc(appUrl)}/book/${esc(r.slug)}</a></dd></dl>
      </section>
    </div>
    <div class="stack">
      <section class="panel stack" style="gap:10px"><h2 class="h" style="margin:0">${t('week')}</h2><p class="muted small">${t('weekHelp')}</p>
        <div class="set-days">${[1, 2, 3, 4, 5, 6, 0].map(d => `<span>${t('weekdays')[d]}</span><div><input id="w-${d}" class="mono" value="${esc(r.week[d])}" placeholder="${t('closed')}"><span class="err" id="we-${d}"></span></div>`).join('')}</div></section>
      <section class="panel stack" style="gap:10px"><h2 class="h" style="margin:0">${t('special')}</h2><p class="muted small">${t('specialHelp')}</p>
        <div id="sp" class="stack" style="gap:8px"></div><button class="btn sm" type="button" id="spadd" style="align-self:flex-start">${t('addDate')}</button><span class="err" id="sperr"></span></section>
      <div class="row end savebar"><span class="err" id="ferr"></span><button class="btn pri" type="submit" id="ssave">${t('save')}</button></div>
    </div></form></div>`;
  let specials = r.specials.map(x => ({ ...x }));
  const drawSp = () => {
    $('#sp').innerHTML = specials.map((x, i) => `<div class="sp-row"><input type="date" data-sd="${i}" value="${esc(x.date)}" aria-label="${t('date')}"><input class="mono" data-sh="${i}" value="${esc(x.hours)}" placeholder="${t('closed')}" aria-label="${t('week')}"><input data-sn="${i}" value="${esc(x.note)}" placeholder="${t('noteLbl')}" maxlength="120" aria-label="${t('noteLbl')}"><button class="btn sm dang" type="button" data-rm="${i}">${t('remove')}</button></div>`).join('');
    $$('[data-rm]').forEach(b => b.onclick = () => { collectSp(); specials.splice(+b.dataset.rm, 1); drawSp(); });
  };
  const collectSp = () => { specials = specials.map((x, i) => ({ date: $(`[data-sd="${i}"]`).value, hours: $(`[data-sh="${i}"]`).value.trim(), note: $(`[data-sn="${i}"]`).value.trim() })); };
  drawSp();
  $('#spadd').onclick = () => { collectSp(); specials.push({ date: addDays(todayIn(r.timezone), 7), hours: '', note: '' }); drawSp(); };
  $$('[data-sr]').forEach(b => b.onclick = () => { S.setR = +b.dataset.sr; restView(S.setR); });
  $('#addr').onclick = addRestaurant;
  let color = r.color;
  $$('#sw [data-c]').forEach(b => b.onclick = () => { color = b.dataset.c; $$('#sw [data-c]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
  let dirty = false; $('#rf').addEventListener('input', () => { dirty = true; });
  $('#mtest').onclick = async () => {
    if (dirty) { $('#mres').className = 'note warn small'; $('#mres').textContent = t('saveFirst'); return; }
    const btn = $('#mtest'); btn.disabled = true; $('#mres').textContent = '…'; $('#mres').className = 'small';
    try { const out = await api('POST', `/api/restaurants/${r.id}/mail-test`, { to: $('#m-to').value }); $('#mres').className = out.ok ? 'note ok small' : 'note bad small'; $('#mres').textContent = out.ok ? t('testOk', { e: $('#m-to').value }) : t('testFail', { e: out.error }); }
    catch (e) { $('#mres').textContent = e.status === 422 ? t('e_email') : ''; }
    finally { btn.disabled = false; }
  };
  $('#newkey').onclick = () => sheet(`<h2>${t('newKeyQ')}</h2><p>${t('newKeyText')}</p><div class="row end"><button class="btn" data-close>${t('no')}</button><button class="btn pri" id="kgo">${t('create')}</button></div>`, () => {
    $('#kgo').onclick = async () => {
      let out; try { out = await api('POST', `/api/restaurants/${r.id}/key`, {}); } catch { return; }
      sheet(`<h2>${t('keyNow')} · ${esc(r.name)}</h2><p>${t('keyOnce')}</p><div class="keybox"><span class="copy">${esc(out.key)}</span><button class="btn sm" id="kc">${t('copy')}</button></div><dl class="kv"><dt>${t('appAddr')}</dt><dd><span class="copy">${esc(appUrl)}</span></dd></dl><div class="row end"><button class="btn pri" data-close>${t('done')}</button></div>`, () => { $('#kc').onclick = e => copyText(out.key, e.target); });
      restView(r.id);
    };
  });
  $('#rf').onsubmit = async e => {
    e.preventDefault(); collectSp();
    $$('#rf .err').forEach(x => { x.textContent = ''; });
    const week = [0, 1, 2, 3, 4, 5, 6].map(d => $('#w-' + d).value.trim());
    const body = {
      online: $('#s-on').checked, name: $('#s-name').value, domain: $('#s-dom').value, color, timezone: $('#s-tz').value, phone: $('#s-ph').value, email: $('#s-em').value,
      address: $('#s-ad').value, extraNote: $('#s-ex').value, privacyUrl: $('#s-pr').value.trim(), week, specials,
      rules: { interval: +$('#s-int').value, lastBefore: +$('#s-lb').value, lead: +$('#s-lead').value, maxDays: +$('#s-max').value, maxParty: +$('#s-mp').value, cap: +$('#s-cap').value, remind: +$('#s-rm').value, stay: +$('#s-stay').value, stayEvening: +$('#s-stayE').value },
      mail: { fromName: $('#m-name').value, host: $('#m-host').value.trim(), port: +$('#m-port').value, user: $('#m-user').value.trim(), pass: $('#m-pass').value, clearPass: !!($('#m-clear') && $('#m-clear').checked) },
    };
    $('#ssave').disabled = true;
    try { await api('PUT', `/api/restaurants/${r.id}`, body); toast(t('savedRest')); restView(r.id); }
    catch (err) {
      $('#ssave').disabled = false;
      if (err.status !== 422) return;
      const E = err.data.errors || {};
      Object.entries(E).forEach(([k, v]) => {
        if (k === 'week') (Array.isArray(v) ? v : [0, 1, 2, 3, 4, 5, 6]).forEach(i => { $('#we-' + i).textContent = t('badFmt'); });
        else if (k === 'specials') $('#sperr').textContent = t('checkSpecial');
        else { const el = $(`[data-e="${k}"]`); if (el) el.textContent = errText(k, v); }
      });
      $('#ferr').textContent = t('fixErrors');
      const first = $$('#rf .err').find(x => x.textContent); if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };
}
function addRestaurant() {
  sheet(`<h2>${t('newRest')}</h2>
    <label class="f" for="n-name">${t('name')}<input id="n-name" maxlength="120"><span class="err" data-ne="name"></span></label>
    <label class="f" for="n-dom">${t('website')}<input id="n-dom" placeholder="restaurant.com.au"></label>
    <label class="f" for="n-tz">${t('tz')}<select id="n-tz">${(RS ? RS.timezones : ['Australia/Melbourne']).map(z => `<option>${z}</option>`).join('')}</select></label>
    <div class="g2"><label class="f" for="n-ph">${t('restPhone')}<input id="n-ph" type="tel" placeholder="(03) 9123 4567"><span class="err" data-ne="phone"></span></label><label class="f" for="n-em">${t('restEmail')}<input id="n-em" type="email"><span class="err" data-ne="email"></span></label></div>
    <p class="note">${t('newRestNote')}</p>
    <div class="row end"><button class="btn" data-close>${t('no')}</button><button class="btn pri" id="n-go">${t('create')}</button></div>`, () => {
    $('#n-go').onclick = async () => {
      $$('[data-ne]').forEach(x => { x.textContent = ''; });
      try {
        const out = await api('POST', '/api/restaurants', { name: $('#n-name').value, domain: $('#n-dom').value, timezone: $('#n-tz').value, phone: $('#n-ph').value, email: $('#n-em').value });
        sheet(`<h2>${esc(out.restaurant.name)}</h2><p>${t('restCreated', { n: esc(out.restaurant.name) })}</p><p>${t('keyOnce')}</p><div class="keybox"><span class="copy">${esc(out.key)}</span><button class="btn sm" id="kc">${t('copy')}</button></div><div class="row end"><button class="btn pri" data-close>${t('done')}</button></div>`, () => { $('#kc').onclick = e => copyText(out.key, e.target); });
        S.setR = out.restaurant.id; restView(out.restaurant.id);
      } catch (err) { if (err.status === 422) Object.entries(err.data.errors || {}).forEach(([k, v]) => { const el = $(`[data-ne="${k}"]`); if (el) el.textContent = errText(k, v); }); }
    };
  });
}

/* ============ accounts, security, system (owner) ============ */
async function usersView() {
  let U, set, sys;
  try { [U, set, sys] = await Promise.all([api('GET', '/api/admin/users'), api('GET', '/api/admin/settings'), api('GET', '/api/admin/system')]); } catch { return; }
  if (S.tab !== 'users') return;
  const rs = S.restaurants;
  const dep = sys.deploys;
  const depLine = !dep ? t('cleanupNone') : dep.skipped ? t('cleanupSkip', { t: stamp(dep.at), s: dep.skipped }) : t('cleanupLast', { t: stamp(dep.at), r: dep.running, n: dep.removed.length });
  $('#pane').innerHTML = `<div class="grid-app"><div class="stack">
    <section class="panel"><h2>${t('users')}</h2><ul class="users">${U.users.map(u => `<li><div style="min-width:0"><b>${esc(u.name)}</b> ${u.active ? '' : `<span class="chip st-cancelled">${t('inactive')}</span>`} ${u.locked ? `<span class="chip st-declined">${t('lockedNow')}</span>` : ''}<br><span class="muted copy">${esc(u.email)}</span><br><span class="muted small">${t('lastLogin')}: ${u.lastLoginAt ? stamp(u.lastLoginAt) : u.hasPassword ? t('never') : t('noPw')} · ${u.devices ? t('devices', { n: u.devices }) : t('noDevices')}</span></div>
      <div class="row"><span class="chip ${u.role === 'owner' ? 'st-confirmed' : 'st-cancelled'}">${u.role === 'owner' ? t('owner') : t('staff')}</span><span class="chip st-cancelled">${u.lang.toUpperCase()}</span><span class="muted small">${u.role === 'owner' ? t('allRest') : u.restaurantIds.map(id => esc(rest(id).name)).join(', ')}</span><button class="btn sm" data-edit="${u.id}">${t('edit')}</button></div></li>`).join('')}</ul></section>
    <section class="panel stack" style="gap:10px"><h2 class="h" style="margin:0">${t('addStaff')}</h2>
      <div class="g2"><label class="f" for="u-n">${t('personName')}<input id="u-n" maxlength="120"><span class="err" data-ue="name"></span></label><label class="f" for="u-e">${t('email')}<input id="u-e" type="email"><span class="err" data-ue="email"></span></label></div>
      <div class="g2"><label class="f" for="u-role">${t('role')}<select id="u-role"><option value="staff">${t('staff')}</option><option value="owner">${t('owner')}</option></select></label><label class="f" for="u-l">${t('lang')}<select id="u-l"><option value="vi">Tiếng Việt</option><option value="en">English</option></select></label></div>
      <fieldset style="border:0;padding:0;margin:0" id="u-rs"><legend class="muted small" style="font-weight:600">${t('access')}</legend><div class="row">${rs.map(r => `<label class="check" for="ur-${r.id}"><input type="checkbox" id="ur-${r.id}" value="${r.id}"> ${esc(r.name)}</label>`).join('')}</div><span class="err" data-ue="restaurantIds"></span></fieldset>
      <p class="note">${t('inviteNote')}</p><button class="btn pri" id="u-go" style="align-self:flex-start">${t('invite')}</button></section>
  </div><div class="stack">
    <section class="panel stack" style="gap:10px"><h2 class="h" style="margin:0">${t('security')}</h2>
      <p class="muted small">${t('secNote')}</p></section>
    <section class="panel stack" style="gap:10px"><h2 class="h" style="margin:0">${t('myPw')}</h2>
      <form id="mp" class="stack" style="gap:10px"><input type="email" autocomplete="username" value="${esc(S.me.user.email)}" hidden>
      <label class="f" for="mp0">${t('curPw')}<input id="mp0" type="password" autocomplete="current-password"></label>
      <label class="f" for="mp1">${t('newPw')}<input id="mp1" type="password" autocomplete="new-password"></label>
      <p class="err" id="mperr"></p><button class="btn" type="submit" style="align-self:flex-start">${t('save')}</button></form></section>
    <section class="panel stack" style="gap:10px"><h2 class="h" style="margin:0">${t('system')}</h2>
      ${sys.adminPasswordInEnv ? `<p class="note bad">${t('adminPwWarn')}</p>` : ''}
      <dl class="kv"><dt>${t('sysDb')}</dt><dd>${sys.database === 'ready' ? '✓ ' + t('okWord') : esc(sys.database)}</dd>
      <dt>${t('sysMail')}</dt><dd>${sys.systemMail ? '✓ ' + esc(sys.systemMailFrom) : `<span class="err">${t('notSet')}</span>`}</dd>
      <dt>${t('sysEnc')}</dt><dd>${sys.encryption ? '✓ ' + t('yes') : `<span class="err">${t('notSet')}</span>`}</dd>
      <dt>${t('sysFailed')}</dt><dd>${sys.failedEmails7d ? `<span class="err">${sys.failedEmails7d}</span>` : '0'}</dd>
      <dt>${t('sysVer')}</dt><dd class="mono">${esc(sys.version)}</dd></dl>
      <label class="check" for="dc"><input id="dc" type="checkbox" ${set.deployCleanup ? 'checked' : ''}> ${t('cleanup')}</label><p class="muted small">${esc(depLine)}</p></section>
  </div></div>`;
  $$('[data-edit]').forEach(b => b.onclick = () => editUser(U.users.find(u => u.id === +b.dataset.edit)));
  $('#u-role').onchange = e => { $('#u-rs').hidden = e.target.value === 'owner'; };
  $('#u-go').onclick = async () => {
    $$('[data-ue]').forEach(x => { x.textContent = ''; });
    const body = { name: $('#u-n').value, email: $('#u-e').value, role: $('#u-role').value, lang: $('#u-l').value, restaurantIds: $$('#u-rs input:checked').map(x => +x.value) };
    try { const out = await api('POST', '/api/admin/users', body); linkSheet(t('invited'), out.link); usersView(); }
    catch (err) { if (err.status === 422) Object.entries(err.data.errors || {}).forEach(([k, v]) => { const el = $(`[data-ue="${k}"]`); if (el) el.textContent = errText(k, v); }); }
  };
  $('#dc').onchange = async e => { try { await api('PUT', '/api/admin/settings', { deployCleanup: e.target.checked }); toast(t('saved')); } catch { /* toast */ } };
  $('#mp').onsubmit = async e => {
    e.preventDefault(); $('#mperr').textContent = '';
    if ($('#mp1').value.length < 10) { $('#mperr').textContent = t('pwShort'); return; }
    try { await api('POST', '/api/auth/me/password', { current: $('#mp0').value, password: $('#mp1').value }); toast(t('pwChanged')); $('#mp0').value = ''; $('#mp1').value = ''; }
    catch (err) { $('#mperr').textContent = err.data && err.data.error === 'current' ? t('curWrong') : t('pwShort'); }
  };
}
function linkSheet(msg, link) {
  sheet(`<h2>${t('sendPwLink')}</h2><p>${msg}</p><div class="keybox"><span class="copy">${esc(link)}</span><button class="btn sm" id="lc">${t('copy')}</button></div><div class="row end"><button class="btn pri" data-close>${t('done')}</button></div>`, () => { $('#lc').onclick = e => copyText(link, e.target); });
}
function editUser(u) {
  sheet(`<h2>${esc(u.name)}</h2><p class="muted copy">${esc(u.email)}</p>
    <label class="f" for="e-n">${t('personName')}<input id="e-n" value="${esc(u.name)}" maxlength="120"></label>
    <div class="g2"><label class="f" for="e-role">${t('role')}<select id="e-role"><option value="staff" ${u.role === 'staff' ? 'selected' : ''}>${t('staff')}</option><option value="owner" ${u.role === 'owner' ? 'selected' : ''}>${t('owner')}</option></select></label>
      <label class="f" for="e-l">${t('lang')}<select id="e-l"><option value="vi" ${u.lang === 'vi' ? 'selected' : ''}>Tiếng Việt</option><option value="en" ${u.lang === 'en' ? 'selected' : ''}>English</option></select></label></div>
    <fieldset style="border:0;padding:0;margin:0" id="e-rs" ${u.role === 'owner' ? 'hidden' : ''}><legend class="muted small" style="font-weight:600">${t('access')}</legend><div class="row">${S.restaurants.map(r => `<label class="check" for="er-${r.id}"><input type="checkbox" id="er-${r.id}" value="${r.id}" ${u.restaurantIds.includes(r.id) ? 'checked' : ''}> ${esc(r.name)}</label>`).join('')}</div></fieldset>
    <label class="check" for="e-a"><input id="e-a" type="checkbox" ${u.active ? 'checked' : ''}> ${t('active')}</label>
    <p class="err" id="e-err"></p>
    <p class="muted small">${u.devices ? t('devices', { n: u.devices }) : t('noDevices')}</p>
    <div class="row">${u.locked ? `<button class="btn sm" id="e-unlock">${t('unlock')}</button>` : ''}${u.active ? `<button class="btn sm" id="e-link">${t('sendPwLink')}</button>` : ''}${u.devices ? `<button class="btn sm dang" id="e-out">${t('logoutAll')}</button>` : ''}</div>
    <div class="row end"><button class="btn" data-close>${t('no')}</button><button class="btn pri" id="e-go">${t('save')}</button></div>`, () => {
    $('#e-role').onchange = e => { $('#e-rs').hidden = e.target.value === 'owner'; };
    const ul = $('#e-unlock'); if (ul) ul.onclick = async () => { try { await api('POST', `/api/admin/users/${u.id}/unlock`, {}); closeSheet(); toast(t('saved')); usersView(); } catch { /* toast */ } };
    const eo = $('#e-out'); if (eo) eo.onclick = () => sheet(`<h2>${t('logoutAllQ')}</h2><p>${esc(t('logoutAllUser', { n: u.name }))}</p><div class="row end"><button class="btn" data-close>${t('no')}</button><button class="btn pri danger" id="la-go">${t('logoutAll')}</button></div>`, () => {
      $('#la-go').onclick = async () => { try { const out = await api('POST', `/api/admin/users/${u.id}/logout-all`, {}); closeSheet(); if (out.self) { stopPolling(); S.me = null; loginView(t('loggedOutAll')); return; } toast(t('loggedOutAll')); usersView(); } catch { /* toast */ } };
    });
    const lk = $('#e-link'); if (lk) lk.onclick = async () => { try { const out = await api('POST', `/api/admin/users/${u.id}/link`, {}); linkSheet(t('linkReady'), out.link); } catch { /* toast */ } };
    $('#e-go').onclick = async () => {
      const body = { name: $('#e-n').value, role: $('#e-role').value, lang: $('#e-l').value, active: $('#e-a').checked, restaurantIds: $$('#e-rs input:checked').map(x => +x.value) };
      try { await api('PUT', `/api/admin/users/${u.id}`, body); closeSheet(); toast(t('saved')); usersView(); }
      catch (err) { if (err.status === 422) $('#e-err').textContent = Object.entries(err.data.errors || {}).map(([k, v]) => errText(k, v)).join(' '); }
    };
  });
}

/* ============ activity log (owner) ============ */
async function logView(before) {
  let d; try { d = await api('GET', `/api/admin/audit?filter=${S.logFilter}${before ? '&before=' + before : ''}`); } catch { return; }
  if (S.tab !== 'log') return;
  const rows = d.entries.map(a => `<tr><td class="mono" style="white-space:nowrap">${stamp(a.at)}</td><td>${a.actor === 'guest' ? t('guest_') : a.actor === 'system' ? t('system_') : esc(a.actor)}</td><td><b>${esc(t('a_' + a.action))}</b></td><td class="muted">${esc(a.detail)}${a.ip ? ` <span class="small">· ${esc(a.ip)}</span>` : ''}</td></tr>`).join('');
  if (before) { $('#logbody').insertAdjacentHTML('beforeend', rows); }
  else {
    $('#pane').innerHTML = `<section class="panel stack" style="gap:12px">
      <div class="pills">${['all', 'bookings', 'security'].map(k => `<button class="pill" data-lf="${k}" aria-pressed="${S.logFilter === k}">${t('lf_' + k)}</button>`).join('')}</div>
      <div class="tbl"><table><thead><tr><th>${t('when')}</th><th>${t('who')}</th><th>${t('what')}</th><th>${t('detail')}</th></tr></thead><tbody id="logbody">${rows || `<tr><td colspan="4" class="empty">${t('noLog')}</td></tr>`}</tbody></table></div>
      <div id="logmore"></div><p class="muted small">${t('logRo')}</p></section>`;
    $$('[data-lf]').forEach(b => b.onclick = () => { S.logFilter = b.dataset.lf; logView(); });
  }
  const last = d.entries[d.entries.length - 1];
  $('#logmore').innerHTML = d.more && last ? `<button class="btn sm" id="lm">${t('more')}</button>` : '';
  const lm = $('#lm'); if (lm) lm.onclick = () => logView(last.id);
}

/* ============ service worker ============ */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

boot();
})();
