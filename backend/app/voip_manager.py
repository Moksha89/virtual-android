import os
import logging
from typing import Optional
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse
from twilio.twiml.messaging_response import MessagingResponse

logger = logging.getLogger(__name__)


class VoIPManager:
    
    def __init__(self):
        account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.phone_number = os.getenv("TWILIO_PHONE_NUMBER")
        
        if account_sid and auth_token:
            self.client = Client(account_sid, auth_token)
            self.enabled = True
            logger.info("VoIP manager initialized with Twilio")
        else:
            self.client = None
            self.enabled = False
            logger.warning("VoIP not configured - Twilio credentials missing")
    
    async def make_call(self, instance_id: str, to_number: str) -> Optional[str]:
        if not self.enabled:
            raise Exception("VoIP not configured")
        
        try:
            call = self.client.calls.create(
                to=to_number,
                from_=self.phone_number,
                url=f"https://155.117.44.194/api/voip/call-webhook?instance={instance_id}",
                method="POST"
            )
            logger.info(f"Call initiated for instance {instance_id}: {call.sid}")
            return call.sid
            
        except Exception as e:
            logger.error(f"Failed to make call: {e}")
            raise
    
    async def send_sms(self, instance_id: str, to_number: str, message: str) -> Optional[str]:
        if not self.enabled:
            raise Exception("VoIP not configured")
        
        try:
            sms = self.client.messages.create(
                to=to_number,
                from_=self.phone_number,
                body=message
            )
            logger.info(f"SMS sent for instance {instance_id}: {sms.sid}")
            return sms.sid
            
        except Exception as e:
            logger.error(f"Failed to send SMS: {e}")
            raise
    
    def handle_incoming_call(self, instance_id: str) -> str:
        response = VoiceResponse()
        response.say("This is a virtual Android phone. Please leave a message.")
        response.record(max_length=30)
        return str(response)
    
    def handle_incoming_sms(self, instance_id: str, from_number: str, body: str) -> str:
        logger.info(f"Incoming SMS for instance {instance_id} from {from_number}: {body}")
        
        response = MessagingResponse()
        response.message("Message received by virtual Android phone")
        return str(response)


voip_manager = VoIPManager()
