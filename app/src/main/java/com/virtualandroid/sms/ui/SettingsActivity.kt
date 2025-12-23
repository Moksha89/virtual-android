package com.virtualandroid.sms.ui

import android.os.Bundle
import android.view.MenuItem
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.virtualandroid.sms.R
import com.virtualandroid.sms.SmsApplication
import com.virtualandroid.sms.databinding.ActivitySettingsBinding
import com.virtualandroid.sms.service.SmsSyncService
import com.virtualandroid.sms.util.DateUtils
import com.virtualandroid.sms.util.PermissionHelper

class SettingsActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySettingsBinding

    private val defaultSmsLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { _ ->
        updateDefaultSmsStatus()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupToolbar()
        setupDefaultSmsSection()
        setupSyncSection()
        setupDataManagement()
        loadSettings()
    }

    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        binding.toolbar.setNavigationOnClickListener {
            onBackPressedDispatcher.onBackPressed()
        }
    }

    private fun setupDefaultSmsSection() {
        binding.btnSetDefault.setOnClickListener {
            PermissionHelper.requestDefaultSmsApp(defaultSmsLauncher, this)
        }
        updateDefaultSmsStatus()
    }

    private fun updateDefaultSmsStatus() {
        val isDefault = PermissionHelper.isDefaultSmsApp(this)
        binding.tvDefaultSmsStatus.text = if (isDefault) {
            "This app is the default SMS app"
        } else {
            "This app is not the default SMS app"
        }
        binding.btnSetDefault.isEnabled = !isDefault
    }

    private fun setupSyncSection() {
        val app = application as SmsApplication
        val prefs = app.preferencesManager

        binding.switchSync.setOnCheckedChangeListener { _, isChecked ->
            prefs.syncEnabled = isChecked
            updateSyncUI()
        }

        binding.btnSaveSettings.setOnClickListener {
            saveSettings()
        }

        binding.btnSyncNow.setOnClickListener {
            triggerSync()
        }
    }

    private fun setupDataManagement() {
        binding.btnClearSyncData.setOnClickListener {
            showClearDataConfirmation()
        }
    }

    private fun loadSettings() {
        val app = application as SmsApplication
        val prefs = app.preferencesManager

        binding.switchSync.isChecked = prefs.syncEnabled
        binding.etServerUrl.setText(prefs.serverUrl)
        binding.etApiKey.setText(prefs.apiKey)

        updateSyncUI()
    }

    private fun updateSyncUI() {
        val app = application as SmsApplication
        val prefs = app.preferencesManager

        val syncEnabled = prefs.syncEnabled
        binding.tilServerUrl.isEnabled = syncEnabled
        binding.tilApiKey.isEnabled = syncEnabled
        binding.btnSaveSettings.isEnabled = syncEnabled
        binding.btnSyncNow.isEnabled = syncEnabled && prefs.serverUrl.isNotBlank() && prefs.apiKey.isNotBlank()

        val lastSync = prefs.lastSyncTime
        binding.tvLastSync.text = getString(R.string.last_sync, DateUtils.formatSyncTime(lastSync))
    }

    private fun saveSettings() {
        val app = application as SmsApplication
        val prefs = app.preferencesManager

        val serverUrl = binding.etServerUrl.text?.toString()?.trim() ?: ""
        val apiKey = binding.etApiKey.text?.toString()?.trim() ?: ""

        // Validate
        if (serverUrl.isBlank()) {
            binding.tilServerUrl.error = "Server URL is required"
            return
        } else {
            binding.tilServerUrl.error = null
        }

        if (apiKey.isBlank()) {
            binding.tilApiKey.error = "API Key is required"
            return
        } else {
            binding.tilApiKey.error = null
        }

        // Save
        prefs.serverUrl = serverUrl
        prefs.apiKey = apiKey

        Toast.makeText(this, "Settings saved", Toast.LENGTH_SHORT).show()
        updateSyncUI()
    }

    private fun triggerSync() {
        val app = application as SmsApplication
        val prefs = app.preferencesManager

        if (prefs.serverUrl.isBlank() || prefs.apiKey.isBlank()) {
            Toast.makeText(this, "Please configure server URL and API key first", Toast.LENGTH_SHORT).show()
            return
        }

        SmsSyncService.start(this)
        Toast.makeText(this, "Sync started", Toast.LENGTH_SHORT).show()
    }

    private fun showClearDataConfirmation() {
        MaterialAlertDialogBuilder(this)
            .setTitle("Clear Sync Data")
            .setMessage("This will clear your sync settings and history. Your SMS messages will not be affected.")
            .setPositiveButton("Clear") { _, _ ->
                clearSyncData()
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun clearSyncData() {
        val app = application as SmsApplication
        app.preferencesManager.clearSyncData()

        // Reload UI
        loadSettings()
        Toast.makeText(this, "Sync data cleared", Toast.LENGTH_SHORT).show()
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            android.R.id.home -> {
                onBackPressedDispatcher.onBackPressed()
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }
}
