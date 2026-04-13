#!/bin/bash
set -e

# Ensure the data directories exist and are writable by www-data
# (Docker volumes are mounted as root, so we fix permissions at runtime)
mkdir -p "${DATA_DIR}/logs" "${DATA_DIR}/uploads" "${DATA_DIR}/backups"
chown -R www-data:www-data "${DATA_DIR}"
chmod -R 755 "${DATA_DIR}"

# Also ensure game servers and steamcmd dirs are writable
chown -R www-data:www-data /opt/servers /opt/steamcmd 2>/dev/null || true

# Start cron daemon for scheduled tasks (runs cron.php every minute)
echo "* * * * * www-data php /var/www/html/cron.php >> /var/log/gsm-cron.log 2>&1" > /etc/cron.d/gsm
chmod 0644 /etc/cron.d/gsm
crontab /etc/cron.d/gsm
service cron start || crond -b -l 8 || true

exec "$@"
