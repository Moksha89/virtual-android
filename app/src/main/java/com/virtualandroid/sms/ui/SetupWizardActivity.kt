package com.virtualandroid.sms.ui

import android.accessibilityservice.AccessibilityServiceInfo
import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.virtualandroid.sms.R
import com.virtualandroid.sms.SmsApplication
import com.virtualandroid.sms.service.RemoteControlService
import com.virtualandroid.sms.service.ScreenCaptureService

class SetupWizardActivity : AppCompatActivity() {

    private lateinit var accessibilityStatus: TextView
    private lateinit var accessibilityIcon: ImageView
    private lateinit var accessibilityButton: Button
    
    private lateinit var notificationStatus: TextView
    private lateinit var notificationIcon: ImageView
    private lateinit var notificationButton: Button
    
    private lateinit var screenCaptureStatus: TextView
    private lateinit var screenCaptureIcon: ImageView
    private lateinit var screenCaptureButton: Button
    
    private lateinit var finishButton: Button
    
    private val screenCaptureLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            // Start the screen capture service
            val intent = Intent(this, ScreenCaptureService::class.java).apply {
                action = ScreenCaptureService.ACTION_START
                putExtra(ScreenCaptureService.EXTRA_RESULT_CODE, result.resultCode)
                putExtra(ScreenCaptureService.EXTRA_RESULT_DATA, result.data)
            }
            startForegroundService(intent)
            
            // Save that screen capture was enabled
            val prefs = (application as SmsApplication).preferencesManager
            prefs.screenCaptureEnabled = true
            
            Toast.makeText(this, "Screen sharing enabled", Toast.LENGTH_SHORT).show()
        }
        updateStatus()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_setup_wizard)
        
        setupViews()
        setupClickListeners()
    }
    
    override fun onResume() {
        super.onResume()
        updateStatus()
    }
    
    private fun setupViews() {
        // Accessibility Service
        accessibilityStatus = findViewById(R.id.accessibilityStatus)
        accessibilityIcon = findViewById(R.id.accessibilityIcon)
        accessibilityButton = findViewById(R.id.accessibilityButton)
        
        // Notification Access
        notificationStatus = findViewById(R.id.notificationStatus)
        notificationIcon = findViewById(R.id.notificationIcon)
        notificationButton = findViewById(R.id.notificationButton)
        
        // Screen Capture
        screenCaptureStatus = findViewById(R.id.screenCaptureStatus)
        screenCaptureIcon = findViewById(R.id.screenCaptureIcon)
        screenCaptureButton = findViewById(R.id.screenCaptureButton)
        
        // Finish button
        finishButton = findViewById(R.id.finishButton)
    }
    
    private fun setupClickListeners() {
        accessibilityButton.setOnClickListener {
            openAccessibilitySettings()
        }
        
        notificationButton.setOnClickListener {
            openNotificationListenerSettings()
        }
        
        screenCaptureButton.setOnClickListener {
            requestScreenCapture()
        }
        
        finishButton.setOnClickListener {
            if (isSetupComplete()) {
                // Mark setup as complete
                val prefs = (application as SmsApplication).preferencesManager
                prefs.setupComplete = true
                
                // Go to main activity
                startActivity(Intent(this, MainActivity::class.java))
                finish()
            } else {
                Toast.makeText(this, "Please complete all setup steps", Toast.LENGTH_SHORT).show()
            }
        }
    }
    
    private fun updateStatus() {
        val prefs = (application as SmsApplication).preferencesManager
        
        // Accessibility Service status
        val accessibilityEnabled = isAccessibilityServiceEnabled()
        if (accessibilityEnabled) {
            accessibilityStatus.text = "Enabled"
            accessibilityStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_green_dark))
            accessibilityIcon.setImageResource(android.R.drawable.checkbox_on_background)
            accessibilityButton.text = "Enabled"
            accessibilityButton.isEnabled = false
        } else {
            accessibilityStatus.text = "Not enabled"
            accessibilityStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_red_dark))
            accessibilityIcon.setImageResource(android.R.drawable.checkbox_off_background)
            accessibilityButton.text = "Enable"
            accessibilityButton.isEnabled = true
        }
        
        // Notification Listener status
        val notificationEnabled = isNotificationListenerEnabled()
        if (notificationEnabled) {
            notificationStatus.text = "Enabled"
            notificationStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_green_dark))
            notificationIcon.setImageResource(android.R.drawable.checkbox_on_background)
            notificationButton.text = "Enabled"
            notificationButton.isEnabled = false
        } else {
            notificationStatus.text = "Not enabled"
            notificationStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_red_dark))
            notificationIcon.setImageResource(android.R.drawable.checkbox_off_background)
            notificationButton.text = "Enable"
            notificationButton.isEnabled = true
        }
        
        // Screen Capture status - use preference flag instead of deprecated getRunningServices()
        val screenCaptureEnabled = prefs.screenCaptureEnabled || ScreenCaptureService.isServiceRunning(this)
        if (screenCaptureEnabled) {
            screenCaptureStatus.text = "Active"
            screenCaptureStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_green_dark))
            screenCaptureIcon.setImageResource(android.R.drawable.checkbox_on_background)
            screenCaptureButton.text = "Active"
            screenCaptureButton.isEnabled = false
        } else {
            screenCaptureStatus.text = "Not active"
            screenCaptureStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_red_dark))
            screenCaptureIcon.setImageResource(android.R.drawable.checkbox_off_background)
            screenCaptureButton.text = "Start"
            screenCaptureButton.isEnabled = true
        }
        
        // Cache the status values for finish button validation
        cachedAccessibilityEnabled = accessibilityEnabled
        cachedNotificationEnabled = notificationEnabled
        cachedScreenCaptureEnabled = screenCaptureEnabled
        
        // Update finish button
        val setupComplete = cachedAccessibilityEnabled && cachedNotificationEnabled && cachedScreenCaptureEnabled
        finishButton.isEnabled = setupComplete
        if (setupComplete) {
            finishButton.text = "Finish Setup"
        } else {
            finishButton.text = "Complete all steps to continue"
        }
    }
    
    // Cached status values to avoid re-checking between UI update and button click
    private var cachedAccessibilityEnabled = false
    private var cachedNotificationEnabled = false
    private var cachedScreenCaptureEnabled = false
    
    private fun isSetupComplete(): Boolean {
        return cachedAccessibilityEnabled && cachedNotificationEnabled && cachedScreenCaptureEnabled
    }
    
    private fun isAccessibilityServiceEnabled(): Boolean {
        val accessibilityManager = getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
        val enabledServices = accessibilityManager.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
        
        for (service in enabledServices) {
            if (service.resolveInfo.serviceInfo.packageName == packageName &&
                service.resolveInfo.serviceInfo.name == RemoteControlService::class.java.name) {
                return true
            }
        }
        return false
    }
    
    private fun isNotificationListenerEnabled(): Boolean {
        val flat = Settings.Secure.getString(contentResolver, "enabled_notification_listeners")
        if (flat != null && flat.isNotEmpty()) {
            val names = flat.split(":")
            for (name in names) {
                val cn = ComponentName.unflattenFromString(name)
                if (cn != null && cn.packageName == packageName) {
                    return true
                }
            }
        }
        return false
    }
    
    private fun openAccessibilitySettings() {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        startActivity(intent)
        Toast.makeText(this, "Find 'Virtual SMS' and enable it", Toast.LENGTH_LONG).show()
    }
    
    private fun openNotificationListenerSettings() {
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        startActivity(intent)
        Toast.makeText(this, "Find 'Virtual SMS' and enable it", Toast.LENGTH_LONG).show()
    }
    
    private fun requestScreenCapture() {
        val projectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        screenCaptureLauncher.launch(projectionManager.createScreenCaptureIntent())
    }
    
    companion object {
        fun shouldShowSetup(context: Context): Boolean {
            val prefs = (context.applicationContext as SmsApplication).preferencesManager
            return !prefs.setupComplete
        }
    }
}
