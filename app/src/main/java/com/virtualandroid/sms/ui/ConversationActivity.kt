package com.virtualandroid.sms.ui

import android.os.Bundle
import android.view.MenuItem
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.virtualandroid.sms.R
import com.virtualandroid.sms.SmsApplication
import com.virtualandroid.sms.data.SmsMessage
import com.virtualandroid.sms.databinding.ActivityConversationBinding
import com.virtualandroid.sms.util.PermissionHelper
import com.virtualandroid.sms.util.SmsSender
import kotlinx.coroutines.launch

class ConversationActivity : AppCompatActivity() {

    private lateinit var binding: ActivityConversationBinding
    private lateinit var messageAdapter: MessageAdapter

    private var threadId: Long = -1
    private var address: String = ""
    private var contactName: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityConversationBinding.inflate(layoutInflater)
        setContentView(binding.root)

        threadId = intent.getLongExtra(EXTRA_THREAD_ID, -1)
        address = intent.getStringExtra(EXTRA_ADDRESS) ?: ""
        contactName = intent.getStringExtra(EXTRA_CONTACT_NAME) ?: address

        setupToolbar()
        setupRecyclerView()
        setupInput()
        loadMessages()
    }

    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.title = contactName

        binding.toolbar.setOnMenuItemClickListener { item ->
            when (item.itemId) {
                R.id.action_delete -> {
                    showDeleteConfirmation()
                    true
                }
                else -> false
            }
        }
    }

    private fun setupRecyclerView() {
        messageAdapter = MessageAdapter { message ->
            showMessageOptions(message)
        }

        binding.rvMessages.apply {
            layoutManager = LinearLayoutManager(this@ConversationActivity).apply {
                stackFromEnd = true
            }
            adapter = messageAdapter
        }
    }

    private fun setupInput() {
        binding.btnSend.setOnClickListener {
            sendMessage()
        }

        binding.etReply.setOnEditorActionListener { _, _, _ ->
            sendMessage()
            true
        }
    }

    private fun loadMessages() {
        binding.progressBar.visibility = View.VISIBLE

        val app = application as SmsApplication

        lifecycleScope.launch {
            try {
                val messages = if (threadId != -1L) {
                    app.smsRepository.getMessages(threadId)
                } else if (address.isNotEmpty()) {
                    // New conversation or no thread ID - try to load by address
                    val msgsByAddress = app.smsRepository.getMessagesByAddress(address)
                    // Update threadId if we found messages
                    if (msgsByAddress.isNotEmpty()) {
                        threadId = msgsByAddress.first().threadId
                    }
                    msgsByAddress
                } else {
                    emptyList()
                }

                messageAdapter.submitList(messages)

                // Scroll to bottom
                if (messages.isNotEmpty()) {
                    binding.rvMessages.scrollToPosition(messages.size - 1)
                }

                // Mark as read if we have a valid thread
                if (threadId != -1L) {
                    app.smsRepository.markAsRead(threadId)
                }
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(
                    this@ConversationActivity,
                    R.string.error_loading_messages,
                    Toast.LENGTH_SHORT
                ).show()
            } finally {
                binding.progressBar.visibility = View.GONE
            }
        }
    }

    private fun sendMessage() {
        val messageText = binding.etReply.text?.toString()?.trim() ?: ""

        if (messageText.isEmpty()) {
            Toast.makeText(this, R.string.error_empty_message, Toast.LENGTH_SHORT).show()
            return
        }

        if (address.isEmpty()) {
            Toast.makeText(this, R.string.error_invalid_phone, Toast.LENGTH_SHORT).show()
            return
        }

        if (!PermissionHelper.isDefaultSmsApp(this)) {
            Toast.makeText(this, "Cannot send SMS - not default SMS app", Toast.LENGTH_SHORT).show()
            return
        }

        binding.btnSend.isEnabled = false

        lifecycleScope.launch {
            try {
                val app = application as SmsApplication

                // Send the SMS
                val success = SmsSender.sendSms(this@ConversationActivity, address, messageText)

                if (success) {
                    // Insert into sent messages
                    app.smsRepository.insertMessage(
                        address = address,
                        body = messageText,
                        type = SmsMessage.MessageType.SENT
                    )

                    // Clear input
                    binding.etReply.text?.clear()

                    // Reload messages
                    loadMessages()

                    Toast.makeText(
                        this@ConversationActivity,
                        R.string.message_sent,
                        Toast.LENGTH_SHORT
                    ).show()
                } else {
                    Toast.makeText(
                        this@ConversationActivity,
                        R.string.message_failed,
                        Toast.LENGTH_SHORT
                    ).show()
                }
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(
                    this@ConversationActivity,
                    R.string.error_sending_message,
                    Toast.LENGTH_SHORT
                ).show()
            } finally {
                binding.btnSend.isEnabled = true
            }
        }
    }

    private fun showMessageOptions(message: SmsMessage) {
        MaterialAlertDialogBuilder(this)
            .setTitle("Message Options")
            .setItems(arrayOf("Copy", "Delete")) { _, which ->
                when (which) {
                    0 -> copyMessage(message)
                    1 -> deleteMessage(message)
                }
            }
            .show()
    }

    private fun copyMessage(message: SmsMessage) {
        val clipboard = getSystemService(CLIPBOARD_SERVICE) as android.content.ClipboardManager
        val clip = android.content.ClipData.newPlainText("SMS", message.body)
        clipboard.setPrimaryClip(clip)
        Toast.makeText(this, "Message copied", Toast.LENGTH_SHORT).show()
    }

    private fun deleteMessage(message: SmsMessage) {
        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.delete_message)
            .setMessage("Are you sure you want to delete this message?")
            .setPositiveButton("Delete") { _, _ ->
                lifecycleScope.launch {
                    val app = application as SmsApplication
                    app.smsRepository.deleteMessage(message.id)
                    loadMessages()
                }
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun showDeleteConfirmation() {
        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.delete_conversation)
            .setMessage("Are you sure you want to delete this entire conversation?")
            .setPositiveButton("Delete") { _, _ ->
                deleteConversation()
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun deleteConversation() {
        lifecycleScope.launch {
            val app = application as SmsApplication
            app.smsRepository.deleteConversation(threadId)
            finish()
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

    companion object {
        const val EXTRA_THREAD_ID = "thread_id"
        const val EXTRA_ADDRESS = "address"
        const val EXTRA_CONTACT_NAME = "contact_name"
    }
}
