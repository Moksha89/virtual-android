package com.virtualandroid.sms.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.constraintlayout.widget.ConstraintLayout
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.virtualandroid.sms.R
import com.virtualandroid.sms.data.SmsMessage
import com.virtualandroid.sms.databinding.ItemMessageBinding
import com.virtualandroid.sms.util.DateUtils

class MessageAdapter(
    private val onMessageLongClick: ((SmsMessage) -> Unit)? = null
) : ListAdapter<SmsMessage, MessageAdapter.ViewHolder>(MessageDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemMessageBinding.inflate(
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
        private val binding: ItemMessageBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        init {
            binding.cardMessage.setOnLongClickListener {
                val position = bindingAdapterPosition
                if (position != RecyclerView.NO_POSITION) {
                    onMessageLongClick?.invoke(getItem(position))
                }
                true
            }
        }

        fun bind(message: SmsMessage) {
            val context = binding.root.context

            binding.tvMessageBody.text = message.body
            binding.tvMessageTime.text = DateUtils.formatMessageTime(message.date)

            // Position and style based on message direction
            val layoutParams = binding.cardMessage.layoutParams as ConstraintLayout.LayoutParams

            if (message.isIncoming) {
                // Incoming message - align left
                layoutParams.startToStart = ConstraintLayout.LayoutParams.PARENT_ID
                layoutParams.endToEnd = ConstraintLayout.LayoutParams.UNSET
                layoutParams.marginStart = context.resources.getDimensionPixelSize(R.dimen.message_margin_small)
                layoutParams.marginEnd = context.resources.getDimensionPixelSize(R.dimen.message_margin_large)
                binding.cardMessage.setCardBackgroundColor(
                    context.getColor(R.color.message_incoming_bg)
                )
                binding.tvMessageBody.setTextColor(context.getColor(R.color.message_incoming_text))
                binding.ivStatus.visibility = View.GONE
            } else {
                // Outgoing message - align right
                layoutParams.startToStart = ConstraintLayout.LayoutParams.UNSET
                layoutParams.endToEnd = ConstraintLayout.LayoutParams.PARENT_ID
                layoutParams.marginStart = context.resources.getDimensionPixelSize(R.dimen.message_margin_large)
                layoutParams.marginEnd = context.resources.getDimensionPixelSize(R.dimen.message_margin_small)
                binding.cardMessage.setCardBackgroundColor(
                    context.getColor(R.color.message_outgoing_bg)
                )
                binding.tvMessageBody.setTextColor(context.getColor(R.color.message_outgoing_text))

                // Show status icon for outgoing messages
                binding.ivStatus.visibility = View.VISIBLE
                when (message.status) {
                    SmsMessage.MessageStatus.COMPLETE -> {
                        binding.ivStatus.setImageResource(R.drawable.ic_check)
                    }
                    SmsMessage.MessageStatus.PENDING -> {
                        binding.ivStatus.setImageResource(R.drawable.ic_check)
                        binding.ivStatus.alpha = 0.5f
                    }
                    SmsMessage.MessageStatus.FAILED -> {
                        binding.ivStatus.setImageResource(R.drawable.ic_check)
                        binding.ivStatus.setColorFilter(context.getColor(R.color.error))
                    }
                    else -> {
                        binding.ivStatus.visibility = View.GONE
                    }
                }
            }

            binding.cardMessage.layoutParams = layoutParams
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
