package com.virtualandroid.sms.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.virtualandroid.sms.data.Conversation
import com.virtualandroid.sms.databinding.ItemConversationBinding
import com.virtualandroid.sms.util.DateUtils

class ConversationAdapter(
    private val onItemClick: (Conversation) -> Unit
) : ListAdapter<Conversation, ConversationAdapter.ViewHolder>(ConversationDiffCallback()) {

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

        fun bind(conversation: Conversation) {
            binding.tvSender.text = conversation.displayName
            binding.tvPreview.text = conversation.snippet
            binding.tvTime.text = DateUtils.formatConversationTime(conversation.date)

            // Unread indicator
            binding.unreadIndicator.visibility = if (conversation.hasUnread) View.VISIBLE else View.GONE

            // Unread count badge
            if (conversation.unreadCount > 0) {
                binding.tvMessageCount.visibility = View.VISIBLE
                binding.tvMessageCount.text = conversation.unreadCount.toString()
            } else {
                binding.tvMessageCount.visibility = View.GONE
            }

            // Bold text for unread conversations
            val textStyle = if (conversation.hasUnread) {
                android.graphics.Typeface.BOLD
            } else {
                android.graphics.Typeface.NORMAL
            }
            binding.tvSender.setTypeface(null, textStyle)
            binding.tvPreview.setTypeface(null, textStyle)
        }
    }

    class ConversationDiffCallback : DiffUtil.ItemCallback<Conversation>() {
        override fun areItemsTheSame(oldItem: Conversation, newItem: Conversation): Boolean {
            return oldItem.threadId == newItem.threadId
        }

        override fun areContentsTheSame(oldItem: Conversation, newItem: Conversation): Boolean {
            return oldItem == newItem
        }
    }
}
