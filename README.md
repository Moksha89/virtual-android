# Virtual Android SMS App

A consent-based Android SMS application that can read, send, and manage SMS messages. This app is designed to be set as the default SMS handler on Android devices, following Google Play Store policies for SMS apps.

## Features

- **SMS Reading**: Read all SMS messages from the device inbox and sent folders
- **SMS Sending**: Compose and send SMS messages
- **Conversation View**: View messages grouped by conversation/thread
- **SMS Sync**: Optional sync functionality to upload messages to a backend server
- **Encrypted Storage**: Secure storage for sync credentials using Android Keystore
- **Consent-Based**: Explicit user consent required before any data access

## Project Structure

```
app/
├── src/main/
│   ├── java/com/virtualandroid/sms/
│   │   ├── data/           # Data models and repository
│   │   ├── receiver/       # SMS/MMS broadcast receivers
│   │   ├── service/        # Background services
│   │   ├── ui/             # Activities and adapters
│   │   └── util/           # Utility classes
│   └── res/                # Android resources
```

## Requirements

- Android SDK 26+ (Android 8.0 Oreo)
- Kotlin 1.9+
- Gradle 8.2+

## Permissions

The app requires the following permissions to function as a default SMS app:

- `READ_SMS` - Read SMS messages
- `SEND_SMS` - Send SMS messages
- `RECEIVE_SMS` - Receive incoming SMS
- `RECEIVE_MMS` - Receive incoming MMS
- `READ_CONTACTS` - Display contact names
- `INTERNET` - Sync messages (optional)
- `POST_NOTIFICATIONS` - Show new message notifications

## Building

```bash
./gradlew assembleDebug
```

## Backend API (Optional)

The app can sync messages to a backend server. A sample FastAPI backend is provided in the `sms-sync-backend` directory.

### API Endpoints

- `POST /sms/upload` - Upload messages to server
- `GET /sms/sync` - Get synced messages
- `DELETE /sms/purge` - Delete all synced messages
- `GET /sms/stats` - Get sync statistics

### Demo API Key

For testing, use the demo API key: `demo-api-key-12345`

## Usage

1. Install the app on your Android device
2. Grant the required permissions when prompted
3. Set the app as your default SMS app when prompted
4. View your messages in the Conversations, Inbox, or Sent tabs
5. Tap the compose button to send a new message
6. (Optional) Configure sync settings to backup messages to a server

## Security

- All sync credentials are stored using Android's EncryptedSharedPreferences
- API communication uses HTTPS
- User consent is required before any data access
- Persistent notification shown during active sessions

## License

MIT License
