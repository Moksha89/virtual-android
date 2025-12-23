package com.virtualandroid.sms.ui

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.virtualandroid.sms.SmsApplication
import com.virtualandroid.sms.data.Conversation
import com.virtualandroid.sms.data.SmsMessage
import com.virtualandroid.sms.databinding.FragmentMessagesBinding
import kotlinx.coroutines.launch

class MessagesFragment : Fragment() {

    private var _binding: FragmentMessagesBinding? = null
    private val binding get() = _binding!!

    private lateinit var viewType: ViewType
    private var conversationAdapter: ConversationAdapter? = null
    private var messageAdapter: MessageListAdapter? = null

    enum class ViewType {
        CONVERSATIONS,
        INBOX,
        SENT
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        viewType = arguments?.getSerializable(ARG_VIEW_TYPE) as? ViewType ?: ViewType.CONVERSATIONS
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentMessagesBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerView()
        setupSwipeRefresh()
        loadData()
    }

    private fun setupRecyclerView() {
        binding.rvConversations.layoutManager = LinearLayoutManager(requireContext())

        when (viewType) {
            ViewType.CONVERSATIONS -> {
                conversationAdapter = ConversationAdapter { conversation ->
                    openConversation(conversation)
                }
                binding.rvConversations.adapter = conversationAdapter
            }
            ViewType.INBOX, ViewType.SENT -> {
                messageAdapter = MessageListAdapter { message ->
                    openConversation(message)
                }
                binding.rvConversations.adapter = messageAdapter
            }
        }
    }

    private fun setupSwipeRefresh() {
        binding.swipeRefresh.setOnRefreshListener {
            loadData()
        }
    }

    private fun loadData() {
        val app = requireActivity().application as SmsApplication

        binding.progressBar.visibility = View.VISIBLE
        binding.tvEmpty.visibility = View.GONE

        lifecycleScope.launch {
            try {
                when (viewType) {
                    ViewType.CONVERSATIONS -> {
                        val conversations = app.smsRepository.getConversations()
                        conversationAdapter?.submitList(conversations)
                        updateEmptyState(conversations.isEmpty())
                    }
                    ViewType.INBOX -> {
                        val messages = app.smsRepository.getAllMessages()
                            .filter { it.type == SmsMessage.MessageType.INBOX }
                        messageAdapter?.submitList(messages)
                        updateEmptyState(messages.isEmpty())
                    }
                    ViewType.SENT -> {
                        val messages = app.smsRepository.getAllMessages()
                            .filter { it.type == SmsMessage.MessageType.SENT }
                        messageAdapter?.submitList(messages)
                        updateEmptyState(messages.isEmpty())
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
                updateEmptyState(true)
            } finally {
                binding.progressBar.visibility = View.GONE
                binding.swipeRefresh.isRefreshing = false
            }
        }
    }

    private fun updateEmptyState(isEmpty: Boolean) {
        binding.tvEmpty.visibility = if (isEmpty) View.VISIBLE else View.GONE
        binding.rvConversations.visibility = if (isEmpty) View.GONE else View.VISIBLE
    }

    private fun openConversation(conversation: Conversation) {
        val intent = Intent(requireContext(), ConversationActivity::class.java).apply {
            putExtra(ConversationActivity.EXTRA_THREAD_ID, conversation.threadId)
            putExtra(ConversationActivity.EXTRA_ADDRESS, conversation.address)
            putExtra(ConversationActivity.EXTRA_CONTACT_NAME, conversation.displayName)
        }
        startActivity(intent)
    }

    private fun openConversation(message: SmsMessage) {
        val intent = Intent(requireContext(), ConversationActivity::class.java).apply {
            putExtra(ConversationActivity.EXTRA_THREAD_ID, message.threadId)
            putExtra(ConversationActivity.EXTRA_ADDRESS, message.address)
            putExtra(ConversationActivity.EXTRA_CONTACT_NAME, message.contactName ?: message.address)
        }
        startActivity(intent)
    }

    fun refresh() {
        if (_binding != null) {
            loadData()
        }
    }

    override fun onResume() {
        super.onResume()
        loadData()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        private const val ARG_VIEW_TYPE = "view_type"

        fun newInstance(viewType: ViewType): MessagesFragment {
            return MessagesFragment().apply {
                arguments = Bundle().apply {
                    putSerializable(ARG_VIEW_TYPE, viewType)
                }
            }
        }
    }
}
