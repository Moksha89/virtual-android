package com.virtualandroid.sms.ui

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.MenuItem
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.virtualandroid.sms.R
import com.virtualandroid.sms.SmsApplication
import com.virtualandroid.sms.data.SmsMessage
import com.virtualandroid.sms.databinding.ActivityComposeSmsBinding
import com.virtualandroid.sms.util.PermissionHelper
import com.virtualandroid.sms.util.SmsSender
import kotlinx.coroutines.launch

class ComposeSmsActivity : AppCompatActivity() {

    private lateinit var binding: ActivityComposeSmsBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityComposeSmsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupToolbar()
        setupInput()
        handleIntent()
    }

    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        binding.toolbar.setNavigationOnClickListener {
            onBackPressedDispatcher.onBackPressed()
        }
    }

    private fun setupInput() {
        binding.etMessage.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                updateCharCount()
            }
        })

        binding.btnSend.setOnClickListener {
            sendMessage()
        }

        updateCharCount()
    }

    private fun handleIntent() {
        // Handle SMS intents (sms:, smsto:)
        val data = intent.data
        if (data != null) {
            val scheme = data.scheme
            if (scheme == "sms" || scheme == "smsto") {
                val phoneNumber = data.schemeSpecificPart?.replace("-", "")?.replace(" ", "")
                if (!phoneNumber.isNullOrBlank()) {
                    binding.etRecipient.setText(phoneNumber)
                }
            }
        }

        // Handle SENDTO action
        val sendToAddress = intent.getStringExtra("address")
        if (!sendToAddress.isNullOrBlank()) {
            binding.etRecipient.setText(sendToAddress)
        }

        // Handle shared text
        if (intent.action == Intent.ACTION_SEND && intent.type == "text/plain") {
            val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)
            if (!sharedText.isNullOrBlank()) {
                binding.etMessage.setText(sharedText)
            }
        }
    }

    private fun updateCharCount() {
        val length = binding.etMessage.text?.length ?: 0
        val segments = (length / 160) + 1
        val remaining = (segments * 160) - length

        binding.tvCharCount.text = if (segments > 1) {
            "$length/${segments * 160} ($segments)"
        } else {
            "$length/160"
        }
    }

    private fun sendMessage() {
        val recipient = binding.etRecipient.text?.toString()?.trim() ?: ""
        val message = binding.etMessage.text?.toString()?.trim() ?: ""

        // Validate input
        if (recipient.isEmpty()) {
            binding.tilRecipient.error = getString(R.string.error_invalid_phone)
            return
        } else {
            binding.tilRecipient.error = null
        }

        if (message.isEmpty()) {
            binding.tilMessage.error = getString(R.string.error_empty_message)
            return
        } else {
            binding.tilMessage.error = null
        }

        // Check if we have SEND_SMS permission
        if (!PermissionHelper.hasSendSmsPermission(this)) {
            Toast.makeText(this, "SMS permission not granted", Toast.LENGTH_SHORT).show()
            return
        }
        
        // Check if we're the default SMS app (required for full SMS functionality)
        if (!PermissionHelper.isDefaultSmsApp(this)) {
            Toast.makeText(this, "Please set this app as default SMS app to send messages", Toast.LENGTH_LONG).show()
            return
        }

        binding.btnSend.isEnabled = false
        binding.btnSend.text = getString(R.string.sending)

        lifecycleScope.launch {
            try {
                val app = application as SmsApplication

                // Send the SMS
                val success = SmsSender.sendSms(this@ComposeSmsActivity, recipient, message)

                if (success) {
                    // Insert into sent messages
                    app.smsRepository.insertMessage(
                        address = recipient,
                        body = message,
                        type = SmsMessage.MessageType.SENT
                    )

                    Toast.makeText(
                        this@ComposeSmsActivity,
                        R.string.message_sent,
                        Toast.LENGTH_SHORT
                    ).show()

                    // Open conversation
                    val intent = Intent(this@ComposeSmsActivity, ConversationActivity::class.java).apply {
                        putExtra(ConversationActivity.EXTRA_ADDRESS, recipient)
                        putExtra(ConversationActivity.EXTRA_CONTACT_NAME, 
                            app.smsRepository.getContactName(recipient) ?: recipient)
                    }
                    startActivity(intent)
                    finish()
                } else {
                    Toast.makeText(
                        this@ComposeSmsActivity,
                        R.string.message_failed,
                        Toast.LENGTH_SHORT
                    ).show()
                    binding.btnSend.isEnabled = true
                    binding.btnSend.text = getString(R.string.send)
                }
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(
                    this@ComposeSmsActivity,
                    R.string.error_sending_message,
                    Toast.LENGTH_SHORT
                ).show()
                binding.btnSend.isEnabled = true
                binding.btnSend.text = getString(R.string.send)
            }
        }
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
