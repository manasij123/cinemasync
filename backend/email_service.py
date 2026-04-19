"""Resend email helpers for CinemaSync.

Keep sending non-blocking by running Resend's sync SDK via asyncio.to_thread.
"""
import os
import asyncio
import logging

import resend

logger = logging.getLogger(__name__)

resend.api_key = os.environ.get("RESEND_API_KEY")


def _app_url() -> str:
    return (os.environ.get("APP_PUBLIC_URL") or "").rstrip("/")


def _sender() -> str:
    return os.environ.get("SENDER_EMAIL") or "onboarding@resend.dev"


async def _send(to: str, subject: str, html: str) -> dict:
    if not resend.api_key:
        logger.warning("RESEND_API_KEY missing — email skipped")
        return {"skipped": True}
    params = {"from": _sender(), "to": [to], "subject": subject, "html": html}
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        return {"id": result.get("id") if isinstance(result, dict) else None}
    except Exception as e:
        logger.error(f"Resend send failed: {e}")
        raise


def _wrap(title: str, preheader: str, body_html: str, cta_label: str, cta_url: str) -> str:
    return f"""<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#fdf4ff;font-family:Helvetica,Arial,sans-serif;color:#1a0b2e;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">{preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e7c6ff;border-radius:14px;overflow:hidden;">
          <tr><td style="padding:24px 28px;background:linear-gradient(135deg,#7209b7,#f72585);color:#fff;">
            <div style="font-family:'Arial Black',sans-serif;letter-spacing:3px;font-size:13px;opacity:0.85;">CINEMASYNC</div>
            <div style="font-family:'Arial Black',sans-serif;font-size:28px;letter-spacing:1px;margin-top:4px;">{title}</div>
          </td></tr>
          <tr><td style="padding:28px;font-size:15px;line-height:1.55;color:#1a0b2e;">
            {body_html}
            <div style="margin:28px 0;">
              <a href="{cta_url}" style="display:inline-block;background:#7209b7;color:#fff;text-decoration:none;font-weight:bold;letter-spacing:2px;text-transform:uppercase;font-size:13px;padding:14px 22px;border-radius:8px;">{cta_label}</a>
            </div>
            <div style="font-size:12px;color:#6b5b84;line-height:1.55;">
              If the button doesn't work, paste this link into your browser:<br>
              <span style="word-break:break-all;color:#7209b7;">{cta_url}</span>
            </div>
          </td></tr>
          <tr><td style="padding:18px 28px;background:#fdf4ff;border-top:1px solid #e7c6ff;font-size:11px;color:#6b5b84;">
            You're receiving this because an action was requested on your CinemaSync account.<br>
            If that wasn't you, you can safely ignore this email.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>"""


async def send_password_reset(to: str, name: str, token: str) -> dict:
    base = _app_url() or "https://playback-sync-app.preview.emergentagent.com"
    link = f"{base}/reset-password?token={token}"
    body = f"""
      <p>Hi <strong>{name or 'there'}</strong>,</p>
      <p>Someone (hopefully you) asked to reset the password for this CinemaSync account. Click the button below to set a new one — the link expires in <strong>30 minutes</strong>.</p>
    """
    try:
        r = await _send(
            to,
            "Reset your CinemaSync password",
            _wrap("Reset your password", "Reset your CinemaSync password", body, "Reset password", link),
        )
        return {**r, "link": link}
    except Exception as e:
        return {"delivered": False, "link": link, "error": str(e)}


async def send_verify_email(to: str, name: str, token: str) -> dict:
    base = _app_url() or "https://playback-sync-app.preview.emergentagent.com"
    link = f"{base}/verify-email?token={token}"
    body = f"""
      <p>Welcome, <strong>{name or 'there'}</strong>!</p>
      <p>Confirm this email address so we can secure your CinemaSync account and send you room invites you actually want to see.</p>
    """
    try:
        r = await _send(
            to,
            "Confirm your CinemaSync email",
            _wrap("Confirm your email", "Verify your CinemaSync email address", body, "Confirm email", link),
        )
        return {**r, "link": link}
    except Exception as e:
        return {"delivered": False, "link": link, "error": str(e)}
