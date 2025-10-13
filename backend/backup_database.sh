#!/bin/bash

BACKUP_DIR="/home/administrator/virtual-android-backend/backups"
DB_FILE="/home/administrator/virtual-android-backend/virtual_android.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/virtual_android_$TIMESTAMP.db"

mkdir -p "$BACKUP_DIR"

if [ -f "$DB_FILE" ]; then
    cp "$DB_FILE" "$BACKUP_FILE"
    echo "$(date): Database backup created: $BACKUP_FILE" >> /tmp/virtual-android-backup.log
    
    find "$BACKUP_DIR" -name "virtual_android_*.db" -mtime +7 -delete
    echo "$(date): Old backups deleted (>7 days)" >> /tmp/virtual-android-backup.log
else
    echo "$(date): Database file not found: $DB_FILE" >> /tmp/virtual-android-backup.log
fi
