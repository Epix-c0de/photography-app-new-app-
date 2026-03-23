This prompt does NOT redesign UI — it ensures the Admin Gallery Management Tab works correctly and includes all operations like lock/unlock, resend access code, delete, post as announcement, plus advanced features for a professional SaaS photography platform.

MASTER PROMPT — ADMIN DASHBOARD GALLERY MANAGEMENT LOGIC

(Client Galleries Control Panel — Backend Logic Only)

You are implementing the Admin Dashboard Gallery Management System for a photography SaaS application.

This system allows the admin to manage all client galleries that were uploaded using the gallery upload engine.

This prompt focuses ONLY on functionality and backend logic, not UI design.

1. CORE PURPOSE OF THE ADMIN GALLERY TAB

The Gallery Tab in the Admin Dashboard acts as the control center where the admin can manage every gallery uploaded for clients.

The admin must be able to:

• View all galleries
• View galleries per client
• Lock or unlock gallery access
• Resend gallery access codes
• Delete galleries safely
• Promote a gallery to an announcement
• Monitor download statistics
• Manage payment lock state
• Send reminders to clients

The system must support thousands of galleries without performance degradation.

2. DATABASE STRUCTURE REQUIRED

The gallery tab relies on the following main tables.

galleries
column	type
gallery_id	uuid (PK)
client_id	uuid
title	text
access_code	text UNIQUE
is_locked	boolean
is_paid	boolean
photo_count	integer
created_at	timestamp
updated_at	timestamp
expires_at	timestamp
gallery_photos
column	type
photo_id	uuid
gallery_id	uuid
file_url	text
thumbnail_url	text
file_size	integer
checksum	text
uploaded_at	timestamp
gallery_access_logs

Tracks client access attempts.

column	type
id	uuid
gallery_id	uuid
client_id	uuid
access_time	timestamp
device_info	text
gallery_download_logs

Tracks downloads.

column	type
id	uuid
gallery_id	uuid
client_id	uuid
downloaded_at	timestamp
file_count	integer
3. ADMIN GALLERY LIST ENGINE

The gallery tab must fetch galleries with advanced filtering.

API:

GET /admin/galleries

Supported filters:

?client_id=
?paid=true
?locked=true
?search=
?date_from=
?date_to=

Response must include:

gallery_id
client_name
client_phone
title
photo_count
is_locked
is_paid
created_at
last_viewed
downloads

Pagination required:

limit=20
offset=0
4. LOCK / UNLOCK GALLERY ACCESS

Admins must be able to lock or unlock galleries instantly.

Locked gallery means:

Client cannot view or download photos.

API:

POST /admin/gallery/lock

Payload

{
  gallery_id
}

Server action:

UPDATE galleries
SET is_locked = true
WHERE gallery_id = ?

Unlock gallery

API:

POST /admin/gallery/unlock

UPDATE galleries
SET is_locked = false

Extra rule:

If gallery is unpaid, unlocking must require confirmation.

5. RESEND ACCESS CODE SYSTEM

Admins must be able to resend the access code to the client.

API:

POST /admin/gallery/resend-code

Payload

{
 gallery_id
}

Backend logic:

fetch client phone number

fetch gallery access code

generate message template

Example message:

Hello Mikez,

Your photos are ready.

Access Code: WED-203

Open the app and enter the code to view your gallery.

Download the app here:
https://app.link/download

Resend options:

Admin chooses:

send_sms
send_whatsapp
send_push_notification

The system must log the resend event.

Table:

gallery_code_logs
6. DELETE GALLERY ENGINE

Admins must be able to delete a gallery completely.

API:

DELETE /admin/gallery/{gallery_id}

The deletion process must:

delete gallery record

delete gallery_photos records

delete storage objects

delete logs

Process:

BEGIN TRANSACTION

DELETE FROM gallery_photos
DELETE FROM gallery_download_logs
DELETE FROM gallery_access_logs
DELETE FROM galleries

COMMIT

Storage cleanup:

Delete folder:

/clients/{client_id}/galleries/{gallery_id}

Deletion must be soft-delete optional.

Add field:

is_deleted boolean
7. POST GALLERY AS ANNOUNCEMENT

Admin can promote a gallery to an announcement.

Example:

Wedding highlights can be shared publicly.

API

POST /admin/gallery/promote

Payload

{
gallery_id
title
description
}

Backend logic:

fetch first 5 photos

create announcement

attach gallery preview

Insert into:

announcements
announcement_media

Clients see it in Announcements feed.

8. GALLERY DOWNLOAD STATISTICS

Admin must see:

• total downloads
• unique viewers
• last viewed date
• most downloaded photo

API

GET /admin/gallery/{id}/stats

Response

downloads_total
unique_viewers
last_viewed
top_photo
9. AUTO EXPIRY SYSTEM

Admins can set gallery expiry.

Example:

Gallery expires after 90 days.

Column:

expires_at

Cron job checks:

if now() > expires_at
lock gallery automatically
10. BULK ACTIONS

Admin can perform bulk operations.

Supported actions:

lock multiple galleries
unlock multiple galleries
delete multiple galleries
resend access codes
export galleries

API

POST /admin/galleries/bulk

Payload

{
 gallery_ids: [],
 action: "lock"
}
11. SEARCH ENGINE

Admin must search galleries using:

client name
phone number
access code
gallery title

Use full text search.

12. GALLERY PREVIEW ENGINE

Admins must preview a gallery exactly like a client would.

API

GET /admin/gallery/{id}/preview

Returns:

photos
watermark state
payment lock state
13. CLIENT ACTIVITY HISTORY

Admin must see gallery activity.

Example logs:

client opened gallery
client downloaded photos
client attempted unlock

Table

gallery_activity_logs
14. PAYMENT STATUS CONTROL

Admins must toggle payment state.

API

POST /admin/gallery/mark-paid

This sets:

is_paid = true
is_locked = false

This unlocks photos automatically.

15. ADVANCED FEATURES (HIGH VALUE)
1️⃣ Client Download Heatmap

Shows when downloads happen most.

2️⃣ Gallery Share Tracking

Track if client shares gallery link.

3️⃣ Auto Reminder System

Send reminder if gallery not opened.

Example:

48 hours after upload
4️⃣ Favorite Photo Analytics

See which photos client likes most.

5️⃣ Auto Gallery Highlight Generator

AI generates highlight album.

6️⃣ Storage Usage Monitor

Shows how much storage gallery uses.

7️⃣ Smart Pricing Suggestions

AI suggests price based on photo count.

8️⃣ Gallery Watermark Preview

Admin can preview unpaid watermark.

16. SECURITY RULES

Admin operations must require authentication.

Implement:

role = admin

Only admins can:

delete galleries
unlock galleries
promote galleries
17. PERFORMANCE REQUIREMENTS

The gallery management system must support:

100,000 galleries
millions of photos

Use:

indexes
pagination
cached queries
FINAL INSTRUCTION TO AI BUILDER

Implement a fully functional Admin Gallery Management System that supports:

• gallery locking
• code resending
• deletion
• promotion to announcements
• statistics tracking
• activity monitoring
• bulk operations

without redesigning UI.

Focus entirely on backend reliability, security, and scalability.