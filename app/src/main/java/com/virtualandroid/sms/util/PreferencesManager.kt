package com.virtualandroid.sms.util

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.util.UUID

class PreferencesManager(context: Context) {

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val securePrefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        SECURE_PREFS_NAME,
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    private val regularPrefs: SharedPreferences = context.getSharedPreferences(
        REGULAR_PREFS_NAME,
        Context.MODE_PRIVATE
    )

    // Device ID
    var deviceId: String
        get() {
            var id = securePrefs.getString(KEY_DEVICE_ID, null)
            if (id == null) {
                id = UUID.randomUUID().toString()
                deviceId = id
            }
            return id
        }
        set(value) {
            securePrefs.edit().putString(KEY_DEVICE_ID, value).apply()
        }

    // Sync settings
    var syncEnabled: Boolean
        get() = regularPrefs.getBoolean(KEY_SYNC_ENABLED, false)
        set(value) {
            regularPrefs.edit().putBoolean(KEY_SYNC_ENABLED, value).apply()
        }

    var serverUrl: String
        get() = securePrefs.getString(KEY_SERVER_URL, "") ?: ""
        set(value) {
            securePrefs.edit().putString(KEY_SERVER_URL, value).apply()
        }

    var apiKey: String
        get() = securePrefs.getString(KEY_API_KEY, "") ?: ""
        set(value) {
            securePrefs.edit().putString(KEY_API_KEY, value).apply()
        }

    var lastSyncTime: Long
        get() = regularPrefs.getLong(KEY_LAST_SYNC_TIME, 0)
        set(value) {
            regularPrefs.edit().putLong(KEY_LAST_SYNC_TIME, value).apply()
        }

    // Consent
    var consentGiven: Boolean
        get() = regularPrefs.getBoolean(KEY_CONSENT_GIVEN, false)
        set(value) {
            regularPrefs.edit().putBoolean(KEY_CONSENT_GIVEN, value).apply()
        }

    var consentTimestamp: Long
        get() = regularPrefs.getLong(KEY_CONSENT_TIMESTAMP, 0)
        set(value) {
            regularPrefs.edit().putLong(KEY_CONSENT_TIMESTAMP, value).apply()
        }

    // First launch
    var isFirstLaunch: Boolean
        get() = regularPrefs.getBoolean(KEY_FIRST_LAUNCH, true)
        set(value) {
            regularPrefs.edit().putBoolean(KEY_FIRST_LAUNCH, value).apply()
        }

    fun clearSyncData() {
        securePrefs.edit()
            .remove(KEY_SERVER_URL)
            .remove(KEY_API_KEY)
            .apply()
        regularPrefs.edit()
            .putBoolean(KEY_SYNC_ENABLED, false)
            .putLong(KEY_LAST_SYNC_TIME, 0)
            .apply()
    }

    fun clearAll() {
        securePrefs.edit().clear().apply()
        regularPrefs.edit().clear().apply()
    }

    companion object {
        private const val SECURE_PREFS_NAME = "virtual_sms_secure_prefs"
        private const val REGULAR_PREFS_NAME = "virtual_sms_prefs"

        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_SYNC_ENABLED = "sync_enabled"
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_API_KEY = "api_key"
        private const val KEY_LAST_SYNC_TIME = "last_sync_time"
        private const val KEY_CONSENT_GIVEN = "consent_given"
        private const val KEY_CONSENT_TIMESTAMP = "consent_timestamp"
        private const val KEY_FIRST_LAUNCH = "first_launch"
    }
}
