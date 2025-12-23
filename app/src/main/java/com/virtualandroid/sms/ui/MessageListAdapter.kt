package com.virtualandroid.sms.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.virtualandroid.sms.data.SmsMessage
import com.virtualandroid.sms.databinding.ItemConversationBinding
import com.virtualandroid.sms.util.DateUtils

class MessageListAdapter(
    private val onItemClick: (SmsMessage) -> Unit
) : ListAdapter<SmsMessage, MessageListAdapter.ViewHolder>(MessageDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemConversationBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class ViewHolder(
        private val binding: ItemConversationBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        init {
            binding.root.setOnClickListener {
                val position = bindingAdapterPosition
                if (position != RecyclerView.NO_POSITION) {
                    onItemClick(getItem(position))
                }
            }
        }

        fun bind(message: SmsMessage) {
            binding.tvSender.text = message.contactName ?: message.address
            binding.tvPreview.text = message.body
            binding.tvTime.text = DateUtils.formatConversationTime(message.date)

            // Unread indicator
            binding.unreadIndicator.visibility = if (!message.read) View.VISIBLE else View.GONE
            binding.tvMessageCount.visibility = View.GONE

            // Bold text for unread messages
            val textStyle = if (!message.read) {
                android.graphics.Typeface.BOLD
            } else {
                android.graphics.Typeface.NORMAL
            }
            binding.tvSender.setTypeface(null, textStyle)
            binding.tvPreview.setTypeface(null, textStyle)
        }
    }

    class MessageDiffCallback : DiffUtil.ItemCallback<SmsMessage>() {
        override fun areItemsTheSame(oldItem: SmsMessage, newItem: SmsMessage): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: SmsMessage, newItem: SmsMessage): Boolean {
            return oldItem == newItem
        }
    }
}
