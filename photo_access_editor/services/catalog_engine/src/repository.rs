use anyhow::Result;
use chrono::Utc;
use rusqlite::params;
use log::info;

use crate::database::CatalogDatabase;
use crate::models::*;

// ─── Catalog Repository ────────────────────────────────────

pub struct CatalogRepository<'a> {
    db: &'a CatalogDatabase,
}

impl<'a> CatalogRepository<'a> {
    pub fn new(db: &'a CatalogDatabase) -> Self {
        Self { db }
    }

    pub fn create_catalog(&self, name: &str) -> Result<Catalog> {
        let catalog = Catalog::new(name.to_string());
        self.db.connection().execute(
            "INSERT INTO catalogs (catalog_id, name, description, version, created_at, updated_at, status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                catalog.catalog_id,
                catalog.name,
                catalog.description,
                catalog.version,
                catalog.created_at.to_rfc3339(),
                catalog.updated_at.to_rfc3339(),
                catalog.status,
            ],
        )?;
        info!("Created catalog: {} ({})", catalog.name, catalog.catalog_id);
        Ok(catalog)
    }

    pub fn get_catalog(&self, catalog_id: &str) -> Result<Option<Catalog>> {
        let mut stmt = self.db.connection().prepare(
            "SELECT catalog_id, name, description, version, created_at, updated_at, status FROM catalogs WHERE catalog_id = ?1"
        )?;
        let mut rows = stmt.query_map(params![catalog_id], |row| {
            Ok(Catalog {
                catalog_id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                version: row.get(3)?,
                created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now()),
                updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(5)?)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now()),
                status: row.get(6)?,
            })
        })?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    pub fn list_catalogs(&self) -> Result<Vec<Catalog>> {
        let mut stmt = self.db.connection().prepare(
            "SELECT catalog_id, name, description, version, created_at, updated_at, status FROM catalogs ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Catalog {
                catalog_id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                version: row.get(3)?,
                created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now()),
                updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(5)?)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now()),
                status: row.get(6)?,
            })
        })?;
        let mut catalogs = Vec::new();
        for row in rows {
            catalogs.push(row?);
        }
        Ok(catalogs)
    }

    pub fn delete_catalog(&self, catalog_id: &str) -> Result<bool> {
        let affected = self.db.connection().execute(
            "DELETE FROM catalogs WHERE catalog_id = ?1",
            params![catalog_id],
        )?;
        Ok(affected > 0)
    }
}

// ─── Photo Repository ──────────────────────────────────────

pub struct PhotoRepository<'a> {
    db: &'a CatalogDatabase,
}

impl<'a> PhotoRepository<'a> {
    pub fn new(db: &'a CatalogDatabase) -> Self {
        Self { db }
    }

    pub fn insert_photo(&self, photo: &Photo) -> Result<()> {
        self.db.connection().execute(
            "INSERT INTO photos (photo_id, catalog_id, filename, file_path, file_hash, capture_date, camera_make, camera_model, lens, iso, aperture, shutter_speed, focal_length, rating, flag, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
            params![
                photo.photo_id,
                photo.catalog_id,
                photo.filename,
                photo.file_path,
                photo.file_hash,
                photo.capture_date.map(|d| d.to_rfc3339()),
                photo.camera_make,
                photo.camera_model,
                photo.lens,
                photo.iso,
                photo.aperture,
                photo.shutter_speed,
                photo.focal_length,
                photo.rating,
                photo.flag,
                photo.created_at.to_rfc3339(),
                photo.updated_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    pub fn insert_photos(&self, photos: &[Photo]) -> Result<()> {
        let tx = self.db.connection().unchecked_transaction()?;
        {
            let mut stmt = tx.prepare(
                "INSERT INTO photos (photo_id, catalog_id, filename, file_path, file_hash, capture_date, camera_make, camera_model, lens, iso, aperture, shutter_speed, focal_length, rating, flag, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)"
            )?;
            for photo in photos {
                stmt.execute(params![
                    photo.photo_id,
                    photo.catalog_id,
                    photo.filename,
                    photo.file_path,
                    photo.file_hash,
                    photo.capture_date.map(|d| d.to_rfc3339()),
                    photo.camera_make,
                    photo.camera_model,
                    photo.lens,
                    photo.iso,
                    photo.aperture,
                    photo.shutter_speed,
                    photo.focal_length,
                    photo.rating,
                    photo.flag,
                    photo.created_at.to_rfc3339(),
                    photo.updated_at.to_rfc3339(),
                ])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn get_photo(&self, photo_id: &str) -> Result<Option<Photo>> {
        let mut stmt = self.db.connection().prepare(
            "SELECT photo_id, catalog_id, filename, file_path, file_hash, capture_date, camera_make, camera_model, lens, iso, aperture, shutter_speed, focal_length, rating, flag, created_at, updated_at FROM photos WHERE photo_id = ?1"
        )?;
        let mut rows = stmt.query_map(params![photo_id], |row| {
            Ok(Photo {
                photo_id: row.get(0)?,
                catalog_id: row.get(1)?,
                filename: row.get(2)?,
                file_path: row.get(3)?,
                file_hash: row.get(4)?,
                capture_date: row.get::<_, Option<String>>(5)?.and_then(|s| {
                    chrono::DateTime::parse_from_rfc3339(&s)
                        .map(|dt| dt.with_timezone(&Utc))
                        .ok()
                }),
                camera_make: row.get(6)?,
                camera_model: row.get(7)?,
                lens: row.get(8)?,
                iso: row.get(9)?,
                aperture: row.get(10)?,
                shutter_speed: row.get(11)?,
                focal_length: row.get(12)?,
                rating: row.get(13)?,
                flag: row.get(14)?,
                created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(15)?)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now()),
                updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(16)?)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now()),
            })
        })?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    pub fn list_photos(&self, filter: &PhotoFilter) -> Result<Vec<Photo>> {
        let mut conditions = Vec::new();
        let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(ref catalog_id) = filter.catalog_id {
            conditions.push("catalog_id = ?");
            values.push(Box::new(catalog_id.clone()));
        }
        if let Some(rating) = filter.rating {
            conditions.push("rating >= ?");
            values.push(Box::new(rating));
        }
        if let Some(ref flag) = filter.flag {
            conditions.push("flag = ?");
            values.push(Box::new(flag.clone()));
        }
        if let Some(ref camera_make) = filter.camera_make {
            conditions.push("camera_make = ?");
            values.push(Box::new(camera_make.clone()));
        }
        if let Some(ref camera_model) = filter.camera_model {
            conditions.push("camera_model = ?");
            values.push(Box::new(camera_model.clone()));
        }
        if let Some(ref date_from) = filter.date_from {
            conditions.push("capture_date >= ?");
            values.push(Box::new(date_from.to_rfc3339()));
        }
        if let Some(ref date_to) = filter.date_to {
            conditions.push("capture_date <= ?");
            values.push(Box::new(date_to.to_rfc3339()));
        }
        if let Some(ref search) = filter.search {
            conditions.push("(filename LIKE ? OR camera_model LIKE ? OR camera_make LIKE ?)");
            let pattern = format!("%{}%", search);
            values.push(Box::new(pattern.clone()));
            values.push(Box::new(pattern.clone()));
            values.push(Box::new(pattern));
        }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        let limit = filter.limit.unwrap_or(1000);
        let offset = filter.offset.unwrap_or(0);

        let sql = format!(
            "SELECT photo_id, catalog_id, filename, file_path, file_hash, capture_date, camera_make, camera_model, lens, iso, aperture, shutter_speed, focal_length, rating, flag, created_at, updated_at FROM photos {} ORDER BY capture_date DESC NULLS LAST LIMIT {} OFFSET {}",
            where_clause, limit, offset
        );

        let mut stmt = self.db.connection().prepare(&sql)?;
        let param_refs: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
        let rows = stmt.query_map(param_refs.as_slice(), |row| {
            Ok(Photo {
                photo_id: row.get(0)?,
                catalog_id: row.get(1)?,
                filename: row.get(2)?,
                file_path: row.get(3)?,
                file_hash: row.get(4)?,
                capture_date: row.get::<_, Option<String>>(5)?.and_then(|s| {
                    chrono::DateTime::parse_from_rfc3339(&s)
                        .map(|dt| dt.with_timezone(&Utc))
                        .ok()
                }),
                camera_make: row.get(6)?,
                camera_model: row.get(7)?,
                lens: row.get(8)?,
                iso: row.get(9)?,
                aperture: row.get(10)?,
                shutter_speed: row.get(11)?,
                focal_length: row.get(12)?,
                rating: row.get(13)?,
                flag: row.get(14)?,
                created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(15)?)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now()),
                updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(16)?)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now()),
            })
        })?;
        let mut photos = Vec::new();
        for row in rows {
            photos.push(row?);
        }
        Ok(photos)
    }

    pub fn count_photos(&self, catalog_id: &str) -> Result<i64> {
        let count: i64 = self.db.connection().query_row(
            "SELECT COUNT(*) FROM photos WHERE catalog_id = ?1",
            params![catalog_id],
            |row| row.get(0),
        )?;
        Ok(count)
    }

    pub fn update_rating(&self, photo_id: &str, rating: i32) -> Result<bool> {
        let affected = self.db.connection().execute(
            "UPDATE photos SET rating = ?1, updated_at = ?2 WHERE photo_id = ?3",
            params![rating, Utc::now().to_rfc3339(), photo_id],
        )?;
        Ok(affected > 0)
    }

    pub fn update_flag(&self, photo_id: &str, flag: &str) -> Result<bool> {
        let affected = self.db.connection().execute(
            "UPDATE photos SET flag = ?1, updated_at = ?2 WHERE photo_id = ?3",
            params![flag, Utc::now().to_rfc3339(), photo_id],
        )?;
        Ok(affected > 0)
    }

    pub fn delete_photo(&self, photo_id: &str) -> Result<bool> {
        let affected = self.db.connection().execute(
            "DELETE FROM photos WHERE photo_id = ?1",
            params![photo_id],
        )?;
        Ok(affected > 0)
    }

    pub fn delete_photos(&self, photo_ids: &[String]) -> Result<usize> {
        let tx = self.db.connection().unchecked_transaction()?;
        let mut deleted = 0;
        {
            let mut stmt = tx.prepare("DELETE FROM photos WHERE photo_id = ?1")?;
            for id in photo_ids {
                let affected = stmt.execute(params![id])?;
                deleted += affected;
            }
        }
        tx.commit()?;
        Ok(deleted)
    }
}

// ─── Album Repository ──────────────────────────────────────

pub struct AlbumRepository<'a> {
    db: &'a CatalogDatabase,
}

impl<'a> AlbumRepository<'a> {
    pub fn new(db: &'a CatalogDatabase) -> Self {
        Self { db }
    }

    pub fn create_album(&self, catalog_id: &str, name: &str) -> Result<Album> {
        let album = Album::new(catalog_id.to_string(), name.to_string());
        self.db.connection().execute(
            "INSERT INTO albums (album_id, catalog_id, name, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![album.album_id, album.catalog_id, album.name, album.created_at.to_rfc3339()],
        )?;
        Ok(album)
    }

    pub fn list_albums(&self, catalog_id: &str) -> Result<Vec<Album>> {
        let mut stmt = self.db.connection().prepare(
            "SELECT album_id, catalog_id, name, created_at FROM albums WHERE catalog_id = ?1 ORDER BY name"
        )?;
        let rows = stmt.query_map(params![catalog_id], |row| {
            Ok(Album {
                album_id: row.get(0)?,
                catalog_id: row.get(1)?,
                name: row.get(2)?,
                created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(3)?)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now()),
            })
        })?;
        let mut albums = Vec::new();
        for row in rows {
            albums.push(row?);
        }
        Ok(albums)
    }

    pub fn add_photo_to_album(&self, album_id: &str, photo_id: &str, sort_order: i32) -> Result<()> {
        self.db.connection().execute(
            "INSERT OR IGNORE INTO album_photos (album_id, photo_id, sort_order) VALUES (?1, ?2, ?3)",
            params![album_id, photo_id, sort_order],
        )?;
        Ok(())
    }

    pub fn remove_photo_from_album(&self, album_id: &str, photo_id: &str) -> Result<bool> {
        let affected = self.db.connection().execute(
            "DELETE FROM album_photos WHERE album_id = ?1 AND photo_id = ?2",
            params![album_id, photo_id],
        )?;
        Ok(affected > 0)
    }

    pub fn get_album_photos(&self, album_id: &str) -> Result<Vec<Photo>> {
        let mut stmt = self.db.connection().prepare(
            "SELECT p.photo_id, p.catalog_id, p.filename, p.file_path, p.file_hash, p.capture_date, p.camera_make, p.camera_model, p.lens, p.iso, p.aperture, p.shutter_speed, p.focal_length, p.rating, p.flag, p.created_at, p.updated_at FROM photos p INNER JOIN album_photos ap ON p.photo_id = ap.photo_id WHERE ap.album_id = ?1 ORDER BY ap.sort_order"
        )?;
        let rows = stmt.query_map(params![album_id], |row| {
            Ok(Photo {
                photo_id: row.get(0)?,
                catalog_id: row.get(1)?,
                filename: row.get(2)?,
                file_path: row.get(3)?,
                file_hash: row.get(4)?,
                capture_date: row.get::<_, Option<String>>(5)?.and_then(|s| {
                    chrono::DateTime::parse_from_rfc3339(&s)
                        .map(|dt| dt.with_timezone(&Utc))
                        .ok()
                }),
                camera_make: row.get(6)?,
                camera_model: row.get(7)?,
                lens: row.get(8)?,
                iso: row.get(9)?,
                aperture: row.get(10)?,
                shutter_speed: row.get(11)?,
                focal_length: row.get(12)?,
                rating: row.get(13)?,
                flag: row.get(14)?,
                created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(15)?)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now()),
                updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(16)?)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now()),
            })
        })?;
        let mut photos = Vec::new();
        for row in rows {
            photos.push(row?);
        }
        Ok(photos)
    }
}

// ─── Edit Repository ───────────────────────────────────────

pub struct EditRepository<'a> {
    db: &'a CatalogDatabase,
}

impl<'a> EditRepository<'a> {
    pub fn new(db: &'a CatalogDatabase) -> Self {
        Self { db }
    }

    pub fn create_session(&self, photo_id: &str) -> Result<EditSession> {
        let session = EditSession::new(photo_id.to_string());
        self.db.connection().execute(
            "INSERT INTO edit_sessions (session_id, photo_id, created_at, updated_at, status) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![session.session_id, session.photo_id, session.created_at.to_rfc3339(), session.updated_at.to_rfc3339(), session.status],
        )?;
        Ok(session)
    }

    pub fn get_session(&self, session_id: &str) -> Result<Option<EditSession>> {
        let mut stmt = self.db.connection().prepare(
            "SELECT session_id, photo_id, created_at, updated_at, status FROM edit_sessions WHERE session_id = ?1"
        )?;
        let mut rows = stmt.query_map(params![session_id], |row| {
            Ok(EditSession {
                session_id: row.get(0)?,
                photo_id: row.get(1)?,
                created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(2)?)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now()),
                updated_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(3)?)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now()),
                status: row.get(4)?,
            })
        })?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    pub fn add_operation(&self, operation: &EditOperation) -> Result<()> {
        self.db.connection().execute(
            "INSERT INTO edit_operations (operation_id, session_id, operation_type, parameter_json, execution_order, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                operation.operation_id,
                operation.session_id,
                operation.operation_type,
                operation.parameter_json,
                operation.execution_order,
                operation.created_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    pub fn get_operations(&self, session_id: &str) -> Result<Vec<EditOperation>> {
        let mut stmt = self.db.connection().prepare(
            "SELECT operation_id, session_id, operation_type, parameter_json, execution_order, created_at FROM edit_operations WHERE session_id = ?1 ORDER BY execution_order"
        )?;
        let rows = stmt.query_map(params![session_id], |row| {
            Ok(EditOperation {
                operation_id: row.get(0)?,
                session_id: row.get(1)?,
                operation_type: row.get(2)?,
                parameter_json: row.get(3)?,
                execution_order: row.get(4)?,
                created_at: chrono::DateTime::parse_from_rfc3339(&row.get::<_, String>(5)?)
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now()),
            })
        })?;
        let mut ops = Vec::new();
        for row in rows {
            ops.push(row?);
        }
        Ok(ops)
    }

    pub fn clear_operations(&self, session_id: &str) -> Result<usize> {
        let affected = self.db.connection().execute(
            "DELETE FROM edit_operations WHERE session_id = ?1",
            params![session_id],
        )?;
        Ok(affected)
    }
}
