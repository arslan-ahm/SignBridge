"""ICE server (STUN/TURN) config for streamlit-webrtc.

Streamlit Community Cloud's infrastructure means a plain STUN server is no
longer enough to establish the WebRTC connection -- the browser and the app's
container usually can't reach each other directly, so a TURN relay is
required or the camera just hangs on "Connection is taking longer than
expected." Twilio's Network Traversal Service is the option the
streamlit-webrtc project itself recommends (Open Relay Project's free TURN
servers are too flaky in practice). Falls back to Google's public STUN
server if no Twilio credentials are configured, which is enough for local
development but not reliable once deployed here.
"""
import logging
import os

import streamlit as st
from twilio.rest import Client

logger = logging.getLogger(__name__)


@st.cache_data
def get_ice_servers():
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")

    if not account_sid or not auth_token:
        logger.warning(
            "TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN not set -- falling back to a "
            "free Google STUN server, which usually cannot establish a "
            "connection on Streamlit Community Cloud."
        )
        return [{"urls": ["stun:stun.l.google.com:19302"]}]

    client = Client(account_sid, auth_token)
    token = client.tokens.create()
    return token.ice_servers
