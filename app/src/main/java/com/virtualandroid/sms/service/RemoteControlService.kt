package com.virtualandroid.sms.service

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.os.Build
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import java.util.concurrent.ConcurrentLinkedQueue

class RemoteControlService : AccessibilityService() {
    
    companion object {
        private var instance: RemoteControlService? = null
        private val commandQueue = ConcurrentLinkedQueue<RemoteCommand>()
        
        fun getInstance(): RemoteControlService? = instance
        
        fun isServiceEnabled(): Boolean = instance != null
        
        fun queueCommand(command: RemoteCommand) {
            commandQueue.offer(command)
            instance?.processCommands()
        }
        
        fun tap(x: Float, y: Float) {
            queueCommand(RemoteCommand.Tap(x, y))
        }
        
        fun swipe(startX: Float, startY: Float, endX: Float, endY: Float, duration: Long = 300) {
            queueCommand(RemoteCommand.Swipe(startX, startY, endX, endY, duration))
        }
        
        fun longPress(x: Float, y: Float, duration: Long = 1000) {
            queueCommand(RemoteCommand.LongPress(x, y, duration))
        }
        
        fun typeText(text: String) {
            queueCommand(RemoteCommand.TypeText(text))
        }
        
        fun pressBack() {
            queueCommand(RemoteCommand.PressBack)
        }
        
        fun pressHome() {
            queueCommand(RemoteCommand.PressHome)
        }
        
        fun pressRecents() {
            queueCommand(RemoteCommand.PressRecents)
        }
    }
    
    sealed class RemoteCommand {
        data class Tap(val x: Float, val y: Float) : RemoteCommand()
        data class Swipe(val startX: Float, val startY: Float, val endX: Float, val endY: Float, val duration: Long) : RemoteCommand()
        data class LongPress(val x: Float, val y: Float, val duration: Long) : RemoteCommand()
        data class TypeText(val text: String) : RemoteCommand()
        object PressBack : RemoteCommand()
        object PressHome : RemoteCommand()
        object PressRecents : RemoteCommand()
    }
    
    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }
    
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // We don't need to handle accessibility events for remote control
    }
    
    override fun onInterrupt() {
        // Handle interruption
    }
    
    override fun onDestroy() {
        instance = null
        super.onDestroy()
    }
    
    private fun processCommands() {
        while (commandQueue.isNotEmpty()) {
            val command = commandQueue.poll() ?: continue
            executeCommand(command)
        }
    }
    
    private fun executeCommand(command: RemoteCommand) {
        when (command) {
            is RemoteCommand.Tap -> performTap(command.x, command.y)
            is RemoteCommand.Swipe -> performSwipe(command.startX, command.startY, command.endX, command.endY, command.duration)
            is RemoteCommand.LongPress -> performLongPress(command.x, command.y, command.duration)
            is RemoteCommand.TypeText -> performTypeText(command.text)
            is RemoteCommand.PressBack -> performGlobalAction(GLOBAL_ACTION_BACK)
            is RemoteCommand.PressHome -> performGlobalAction(GLOBAL_ACTION_HOME)
            is RemoteCommand.PressRecents -> performGlobalAction(GLOBAL_ACTION_RECENTS)
        }
    }
    
    private fun performTap(x: Float, y: Float) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            val path = Path()
            path.moveTo(x, y)
            
            val gestureBuilder = GestureDescription.Builder()
            gestureBuilder.addStroke(GestureDescription.StrokeDescription(path, 0, 100))
            
            dispatchGesture(gestureBuilder.build(), object : GestureResultCallback() {
                override fun onCompleted(gestureDescription: GestureDescription?) {
                    super.onCompleted(gestureDescription)
                }
                
                override fun onCancelled(gestureDescription: GestureDescription?) {
                    super.onCancelled(gestureDescription)
                }
            }, null)
        }
    }
    
    private fun performSwipe(startX: Float, startY: Float, endX: Float, endY: Float, duration: Long) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            val path = Path()
            path.moveTo(startX, startY)
            path.lineTo(endX, endY)
            
            val gestureBuilder = GestureDescription.Builder()
            gestureBuilder.addStroke(GestureDescription.StrokeDescription(path, 0, duration))
            
            dispatchGesture(gestureBuilder.build(), object : GestureResultCallback() {
                override fun onCompleted(gestureDescription: GestureDescription?) {
                    super.onCompleted(gestureDescription)
                }
                
                override fun onCancelled(gestureDescription: GestureDescription?) {
                    super.onCancelled(gestureDescription)
                }
            }, null)
        }
    }
    
    private fun performLongPress(x: Float, y: Float, duration: Long) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            val path = Path()
            path.moveTo(x, y)
            
            val gestureBuilder = GestureDescription.Builder()
            gestureBuilder.addStroke(GestureDescription.StrokeDescription(path, 0, duration))
            
            dispatchGesture(gestureBuilder.build(), object : GestureResultCallback() {
                override fun onCompleted(gestureDescription: GestureDescription?) {
                    super.onCompleted(gestureDescription)
                }
                
                override fun onCancelled(gestureDescription: GestureDescription?) {
                    super.onCancelled(gestureDescription)
                }
            }, null)
        }
    }
    
    private fun performTypeText(text: String) {
        val rootNode = rootInActiveWindow ?: return
        val focusedNode = findFocusedEditText(rootNode)
        
        if (focusedNode != null) {
            val arguments = android.os.Bundle()
            arguments.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
            focusedNode.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
        }
        
        rootNode.recycle()
    }
    
    private fun findFocusedEditText(node: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        if (node.isFocused && node.isEditable) {
            return node
        }
        
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val result = findFocusedEditText(child)
            if (result != null) {
                return result
            }
            child.recycle()
        }
        
        return null
    }
}
