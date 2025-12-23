package com.virtualandroid.sms.ui

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.virtualandroid.sms.SmsApplication
import com.virtualandroid.sms.data.ApiClient
import com.virtualandroid.sms.data.RegisterRequest
import com.virtualandroid.sms.databinding.ActivityRegisterBinding
import com.virtualandroid.sms.service.SmsSyncService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class RegisterActivity : AppCompatActivity() {

    private lateinit var binding: ActivityRegisterBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityRegisterBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val app = application as SmsApplication
        val prefs = app.preferencesManager

        // If already registered, go to main activity
        if (prefs.isRegistered && prefs.deviceToken.isNotBlank()) {
            startMainActivity()
            return
        }

        // Show device ID
        binding.tvDeviceId.text = "Device ID: ${prefs.deviceId}"

        // Pre-fill device name with model
        if (binding.etDeviceName.text.isNullOrBlank()) {
            binding.etDeviceName.setText(android.os.Build.MODEL)
        }

        binding.btnRegister.setOnClickListener {
            registerDevice()
        }
    }

    private fun registerDevice() {
        val deviceName = binding.etDeviceName.text?.toString()?.trim() ?: ""
        val invitePasskey = binding.etInvitePasskey.text?.toString()?.trim() ?: ""

        // Validate
        if (deviceName.isBlank()) {
            binding.tilDeviceName.error = "Device name is required"
            return
        } else {
            binding.tilDeviceName.error = null
        }

        if (invitePasskey.isBlank()) {
            binding.tilInvitePasskey.error = "Invite passkey is required"
            return
        } else {
            binding.tilInvitePasskey.error = null
        }

        // Show loading
        setLoading(true)

        val app = application as SmsApplication
        val prefs = app.preferencesManager

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val apiService = ApiClient.getApiService(prefs.serverUrl)
                val request = RegisterRequest(
                    device_id = prefs.deviceId,
                    device_name = deviceName,
                    invite_passkey = invitePasskey
                )

                val response = apiService.registerDevice(request)

                withContext(Dispatchers.Main) {
                    setLoading(false)

                    if (response.isSuccessful) {
                        val body = response.body()
                        if (body?.success == true && body.device_token != null) {
                            // Save registration data
                            prefs.deviceName = deviceName
                            prefs.deviceToken = body.device_token
                            prefs.isRegistered = true
                            prefs.syncEnabled = true

                            Toast.makeText(this@RegisterActivity, "Registration successful!", Toast.LENGTH_SHORT).show()

                            // Start sync service
                            SmsSyncService.start(this@RegisterActivity)

                            // Go to main activity
                            startMainActivity()
                        } else {
                            showError(body?.message ?: "Registration failed")
                        }
                    } else {
                        showError("Server error: ${response.code()}")
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    setLoading(false)
                    showError("Connection error: ${e.message}")
                }
            }
        }
    }

    private fun setLoading(loading: Boolean) {
        binding.progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        binding.btnRegister.isEnabled = !loading
        binding.etDeviceName.isEnabled = !loading
        binding.etInvitePasskey.isEnabled = !loading
    }

    private fun showError(message: String) {
        binding.tvError.text = message
        binding.tvError.visibility = View.VISIBLE
    }

    private fun startMainActivity() {
        val intent = Intent(this, MainActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }
}
