'use strict';
// Email content. Guest and restaurant emails are in English; emails to app users follow their language.
const { DateTime } = require('luxon');
const { fmtPhone } = require('./rules');
const config = require('../config');

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const t12 = m => { const h = Math.floor(m / 60), mi = m % 60; return `${h % 12 || 12}${mi ? ':' + String(mi).padStart(2, '0') : ''} ${h >= 12 ? 'pm' : 'am'}`; };
const dLong = d => DateTime.fromISO(d).setLocale('en-AU').toFormat('cccc d LLLL yyyy');
const dShort = d => DateTime.fromISO(d).setLocale('en-AU').toFormat('ccc d LLL');
const first = n => String(n || '').trim().split(/\s+/)[0] || 'there';

function layout({ color = '#24305a', title, body, foot }) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f2f2f0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f0;padding:20px 0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1d1d1d">
<tr><td style="background:${esc(color)};color:#ffffff;padding:16px 22px;font-size:18px;font-weight:bold">${esc(title)}</td></tr>
<tr><td style="padding:22px">${body}</td></tr>
<tr><td style="padding:12px 22px;background:#fafafa;color:#888888;font-size:12px">${foot}</td></tr>
</table></td></tr></table></body></html>`;
}
const p = s => `<p style="margin:0 0 14px">${s}</p>`;
const h = s => `<h2 style="margin:0 0 12px;font-size:20px">${s}</h2>`;
function detailsTable(b, labelNote = 'Your requests') {
  const row = (k, v) => `<tr><td style="padding:7px 0;border-bottom:1px solid #eeeeee;color:#777777;width:38%;vertical-align:top">${k}</td><td style="padding:7px 0;border-bottom:1px solid #eeeeee;vertical-align:top">${v}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-collapse:collapse">
${row('Date', `<b>${esc(dLong(b.date))}</b>`)}${row('Time', `<b>${esc(t12(b.time_min))}</b>`)}${row('Guests', esc(b.party))}${row('Name', esc(b.name))}${row('Reference', esc(b.ref))}${b.note ? row(labelNote, esc(b.note).replace(/\n/g, '<br>')) : ''}</table>`;
}
const detailsText = b => `Date: ${dLong(b.date)}\nTime: ${t12(b.time_min)}\nGuests: ${b.party}\nName: ${b.name}\nReference: ${b.ref}${b.note ? `\nRequests: ${b.note}` : ''}`;
const footer = r => [esc(r.name), esc(r.address), r.domain ? esc(r.domain) : ''].filter(Boolean).join(' · ');

function bookingConfirmed(r, b) {
  const subject = `Booking confirmed – ${r.name}, ${dShort(b.date)} at ${t12(b.time_min)}`;
  const body = h(`See you soon, ${esc(first(b.name))}!`) + p(`Your table at ${esc(r.name)} is confirmed.`) + detailsTable(b)
    + (r.extra_note ? p(esc(r.extra_note).replace(/\n/g, '<br>')) : '')
    + p(`${r.address ? `<b>${esc(r.address)}</b><br>` : ''}Need to change or cancel? Call us on ${esc(fmtPhone(r.phone))} or reply to this email.`);
  const text = `See you soon, ${first(b.name)}!\n\nYour table at ${r.name} is confirmed.\n\n${detailsText(b)}\n\n${r.extra_note ? r.extra_note + '\n\n' : ''}${r.address ? r.address + '\n' : ''}Need to change or cancel? Call us on ${fmtPhone(r.phone)} or reply to this email.`;
  return { subject, html: layout({ color: r.color, title: r.name, body, foot: footer(r) }), text };
}

function bookingDeclined(r, b) {
  const subject = `About your booking request – ${r.name}`;
  const body = h(`Sorry, ${esc(first(b.name))}`) + p(`We can't take your booking for ${esc(dLong(b.date))} at ${esc(t12(b.time_min))} (${esc(b.party)} guests).`)
    + (b.decline_reason ? p(`<b>Reason:</b> ${esc(b.decline_reason)}`) : '')
    + p(`Please try another time${r.domain ? ` on ${esc(r.domain)}` : ''}, or call us on ${esc(fmtPhone(r.phone))} and we'll do our best to fit you in.`);
  const text = `Sorry, ${first(b.name)}\n\nWe can't take your booking for ${dLong(b.date)} at ${t12(b.time_min)} (${b.party} guests).\n${b.decline_reason ? `Reason: ${b.decline_reason}\n` : ''}\nPlease try another time, or call us on ${fmtPhone(r.phone)}.`;
  return { subject, html: layout({ color: r.color, title: r.name, body, foot: footer(r) }), text };
}

function newBookingAlert(r, b) {
  const link = `${config.appUrl}/`;
  const subject = `New booking request – ${b.name}, ${dShort(b.date)} ${t12(b.time_min)} (${b.party})`;
  const body = h('New booking request') + detailsTable(b, 'Requests')
    + p(`Phone: ${esc(fmtPhone(b.phone))}<br>Email: ${esc(b.email)}`)
    + p(`<a href="${esc(link)}" style="color:${esc(r.color)};font-weight:bold">Open Saigon Taste Booking</a> to confirm or decline. The guest only gets an email after you confirm.`);
  const text = `New booking request\n\n${detailsText(b)}\nPhone: ${fmtPhone(b.phone)}\nEmail: ${b.email}\n\nConfirm or decline: ${link}`;
  return { subject, html: layout({ color: r.color, title: `${r.name} · Saigon Taste Booking`, body, foot: 'Saigon Taste Booking' }), text };
}

function reminderAlert(r, b, waitedMin) {
  const link = `${config.appUrl}/`;
  const wait = waitedMin < 120 ? `${waitedMin} minutes` : `${Math.round(waitedMin / 60)} hours`;
  const subject = `Reminder: booking waiting for confirmation – ${b.name}, ${dShort(b.date)} ${t12(b.time_min)}`;
  const body = h('A guest is waiting for your reply') + p(`This request has been waiting for ${esc(wait)}. The guest has not received a confirmation yet.`)
    + detailsTable(b, 'Requests') + p(`Phone: ${esc(fmtPhone(b.phone))}`)
    + p(`<a href="${esc(link)}" style="color:${esc(r.color)};font-weight:bold">Open Saigon Taste Booking</a> to confirm or decline.`);
  const text = `A guest is waiting for your reply (${wait}).\n\n${detailsText(b)}\nPhone: ${fmtPhone(b.phone)}\n\n${link}`;
  return { subject, html: layout({ color: r.color, title: `${r.name} · Saigon Taste Booking`, body, foot: 'Saigon Taste Booking' }), text };
}

function mailTest(r) {
  const subject = `Test email from Saigon Taste Booking – ${r.name}`;
  const body = h('It works') + p(`This test was sent from ${esc(r.name)}'s mailbox. Guests will receive booking emails from this address.`);
  return { subject, html: layout({ color: r.color, title: r.name, body, foot: footer(r) }), text: `It works. Guests will receive booking emails from this address (${r.name}).` };
}

const U = {
  vi: {
    reset: ['Đặt lại mật khẩu Saigon Taste Booking', 'Đặt lại mật khẩu', 'Bấm nút dưới đây để đặt mật khẩu mới. Link có hiệu lực trong 1 giờ. Nếu bạn không yêu cầu, hãy bỏ qua email này.', 'Đặt mật khẩu mới'],
    invite: ['Lời mời dùng Saigon Taste Booking', 'Chào {name}', 'Bạn được mời dùng Saigon Taste Booking để quản lý đặt bàn. Bấm nút dưới đây để tự đặt mật khẩu. Link có hiệu lực trong 7 ngày.', 'Đặt mật khẩu và đăng nhập'],
    lock: ['Cảnh báo: tài khoản bị tạm khóa', 'Tài khoản bị tạm khóa', 'Tài khoản {email} vừa nhập sai mật khẩu {n} lần liên tiếp (địa chỉ IP {ip}) và bị khóa {m} phút. Nếu đây không phải nhân viên của bạn, hãy đổi mật khẩu tài khoản này.'],
  },
  en: {
    reset: ['Reset your Saigon Taste Booking password', 'Reset your password', 'Use the button below to choose a new password. The link works for 1 hour. If you did not ask for this, ignore this email.', 'Choose a new password'],
    invite: ['You are invited to Saigon Taste Booking', 'Hi {name}', 'You have been invited to manage bookings with Saigon Taste Booking. Use the button below to set your password. The link works for 7 days.', 'Set password and sign in'],
    lock: ['Alert: account temporarily locked', 'Account locked', 'The account {email} entered a wrong password {n} times in a row (IP {ip}) and is locked for {m} minutes. If this was not your staff, change this account\'s password.'],
  },
};
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => esc(v[k] != null ? v[k] : ''));
const button = (href, label) => `<p style="margin:18px 0"><a href="${esc(href)}" style="display:inline-block;background:#2f4ea3;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:8px">${esc(label)}</a></p><p style="margin:0 0 14px;color:#777777;font-size:12px;word-break:break-all">${esc(href)}</p>`;

function userLink(kind, lang, user, link) {
  const L = (U[lang] || U.vi)[kind];
  const v = { name: user.name };
  return { subject: L[0], html: layout({ title: 'Saigon Taste Booking', body: h(fill(L[1], v)) + p(fill(L[2], v)) + button(link, L[3]), foot: 'Saigon Taste Booking' }), text: `${fill(L[1], v)}\n\n${fill(L[2], v)}\n\n${link}` };
}
function lockAlert(lang, vars) {
  const L = (U[lang] || U.vi).lock;
  return { subject: L[0], html: layout({ color: '#b0302b', title: 'Saigon Taste Booking', body: h(L[1]) + p(fill(L[2], vars)), foot: 'Saigon Taste Booking' }), text: fill(L[2], vars) };
}

module.exports = { esc, t12, dLong, bookingConfirmed, bookingDeclined, newBookingAlert, reminderAlert, mailTest, userLink, lockAlert };
