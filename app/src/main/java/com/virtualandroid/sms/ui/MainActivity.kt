package com.virtualandroid.sms.ui

import android.content.Intent
import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.viewpager2.widget.ViewPager2
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.tabs.TabLayoutMediator
import com.virtualandroid.sms.R
import com.virtualandroid.sms.SmsApplication
import com.virtualandroid.sms.databinding.ActivityMainBinding
import com.virtualandroid.sms.util.PermissionHelper

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var pagerAdapter: MessagesPagerAdapter

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.all { it.value }
        if (allGranted) {
            checkDefaultSmsApp()
        } else {
            showPermissionDeniedDialog()
        }
    }

    private val defaultSmsLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (PermissionHelper.isDefaultSmsApp(this)) {
            loadMessages()
        } else {
            showDefaultSmsRequiredDialog()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupToolbar()
        setupViewPager()
        setupFab()

        checkPermissionsAndConsent()
    }

    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
    }

    private fun setupViewPager() {
        pagerAdapter = MessagesPagerAdapter(this)
        binding.viewPager.adapter = pagerAdapter

        TabLayoutMediator(binding.tabLayout, binding.viewPager) { tab, position ->
            tab.text = when (position) {
                0 -> getString(R.string.conversations)
                1 -> getString(R.string.inbox)
                2 -> getString(R.string.sent)
                else -> ""
            }
        }.attach()

        binding.viewPager.registerOnPageChangeCallback(object : ViewPager2.OnPageChangeCallback() {
            override fun onPageSelected(position: Int) {
                super.onPageSelected(position)
            }
        })
    }

    private fun setupFab() {
        binding.fabCompose.setOnClickListener {
            startActivity(Intent(this, ComposeSmsActivity::class.java))
        }
    }

    private fun checkPermissionsAndConsent() {
        val app = application as SmsApplication

        // Check consent first
        if (!app.preferencesManager.consentGiven) {
            showConsentDialog()
            return
        }

        // Check permissions
        if (!PermissionHelper.hasAllSmsPermissions(this)) {
            requestPermissions()
            return
        }

        // Check default SMS app
        if (!PermissionHelper.isDefaultSmsApp(this)) {
            showDefaultSmsDialog()
            return
        }

        loadMessages()
    }

    private fun showConsentDialog() {
        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.consent_title)
            .setMessage(R.string.consent_message)
            .setPositiveButton(R.string.i_agree) { _, _ ->
                val app = application as SmsApplication
                app.preferencesManager.consentGiven = true
                app.preferencesManager.consentTimestamp = System.currentTimeMillis()
                checkPermissionsAndConsent()
            }
            .setNegativeButton(R.string.i_disagree) { _, _ ->
                finish()
            }
            .setCancelable(false)
            .show()
    }

    private fun requestPermissions() {
        val permissions = PermissionHelper.SMS_PERMISSIONS + PermissionHelper.NOTIFICATION_PERMISSION
        permissionLauncher.launch(permissions)
    }

    private fun checkDefaultSmsApp() {
        if (!PermissionHelper.isDefaultSmsApp(this)) {
            showDefaultSmsDialog()
        } else {
            loadMessages()
        }
    }

    private fun showDefaultSmsDialog() {
        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.set_as_default)
            .setMessage(R.string.default_sms_rationale)
            .setPositiveButton(R.string.set_as_default) { _, _ ->
                PermissionHelper.requestDefaultSmsApp(defaultSmsLauncher, this)
            }
            .setNegativeButton(R.string.cancel) { _, _ ->
                // Allow limited functionality without being default
                loadMessages()
            }
            .setCancelable(false)
            .show()
    }

    private fun showPermissionDeniedDialog() {
        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.permissions_required)
            .setMessage(R.string.sms_permission_rationale)
            .setPositiveButton(R.string.grant_permissions) { _, _ ->
                requestPermissions()
            }
            .setNegativeButton(R.string.cancel) { _, _ ->
                finish()
            }
            .setCancelable(false)
            .show()
    }

    private fun showDefaultSmsRequiredDialog() {
        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.set_as_default)
            .setMessage("This app needs to be set as the default SMS app to fully manage your messages. You can still view messages, but some features may be limited.")
            .setPositiveButton("OK") { _, _ ->
                loadMessages()
            }
            .setCancelable(false)
            .show()
    }

    private fun loadMessages() {
        // Notify fragments to load data
        pagerAdapter.notifyDataSetChanged()
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menuInflater.inflate(R.menu.menu_main, menu)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            R.id.action_settings -> {
                startActivity(Intent(this, SettingsActivity::class.java))
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }

    override fun onResume() {
        super.onResume()
        // Refresh data when returning to the activity
        if (PermissionHelper.hasAllSmsPermissions(this)) {
            pagerAdapter.refreshAll()
        }
    }
}
