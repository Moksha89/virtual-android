package com.virtualandroid.sms.ui

import android.content.Intent
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
            if (isChecked && prefs.isRegistered) {
                SmsSyncService.start(this)
            } else {
                SmsSyncService.stop(this)
            }
            updateSyncUI()
        }

        // Hide server URL and API key fields - they're now automatic
        binding.tilServerUrl.visibility = android.view.View.GONE
        binding.tilApiKey.visibility = android.view.View.GONE
        binding.btnSaveSettings.visibility = android.view.View.GONE

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

        updateSyncUI()
    }

    private fun updateSyncUI() {
        val app = application as SmsApplication
        val prefs = app.preferencesManager

        val syncEnabled = prefs.syncEnabled
        binding.btnSyncNow.isEnabled = syncEnabled && prefs.isRegistered

        val lastSync = prefs.lastSyncTime
        binding.tvLastSync.text = getString(R.string.last_sync, DateUtils.formatSyncTime(lastSync))

        // Show device info
        if (prefs.isRegistered) {
            binding.tvDefaultSmsStatus.text = buildString {
                append("Device: ${prefs.deviceName}\n")
                append("Status: Registered\n")
                append("Sync: ${if (syncEnabled) "Active (every 5 sec)" else "Paused"}")
            }
        }
    }

    private fun triggerSync() {
        val app = application as SmsApplication
        val prefs = app.preferencesManager

        if (!prefs.isRegistered) {
            Toast.makeText(this, "Device not registered", Toast.LENGTH_SHORT).show()
            return
        }

        SmsSyncService.start(this)
        Toast.makeText(this, "Sync service started", Toast.LENGTH_SHORT).show()
    }

    private fun showClearDataConfirmation() {
        MaterialAlertDialogBuilder(this)
            .setTitle("Logout & Clear Data")
            .setMessage("This will log out your device and clear all sync data. You will need to register again.")
            .setPositiveButton("Logout") { _, _ ->
                clearSyncData()
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun clearSyncData() {
        val app = application as SmsApplication
        
        // Stop sync service
        SmsSyncService.stop(this)
        
        // Clear data
        app.preferencesManager.clearSyncData()

        Toast.makeText(this, "Logged out successfully", Toast.LENGTH_SHORT).show()
        
        // Go to register activity
        val intent = Intent(this, RegisterActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
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
