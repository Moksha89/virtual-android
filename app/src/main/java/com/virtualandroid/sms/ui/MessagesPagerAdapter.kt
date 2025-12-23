package com.virtualandroid.sms.ui

import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import androidx.viewpager2.adapter.FragmentStateAdapter

class MessagesPagerAdapter(activity: FragmentActivity) : FragmentStateAdapter(activity) {

    private val fragments = mutableListOf<MessagesFragment>()

    override fun getItemCount(): Int = 3

    override fun createFragment(position: Int): Fragment {
        val fragment = when (position) {
            0 -> MessagesFragment.newInstance(MessagesFragment.ViewType.CONVERSATIONS)
            1 -> MessagesFragment.newInstance(MessagesFragment.ViewType.INBOX)
            2 -> MessagesFragment.newInstance(MessagesFragment.ViewType.SENT)
            else -> MessagesFragment.newInstance(MessagesFragment.ViewType.CONVERSATIONS)
        }
        fragments.add(fragment)
        return fragment
    }

    fun refreshAll() {
        fragments.forEach { it.refresh() }
    }
}
