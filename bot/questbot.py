from telegram import Update
from telegram.ext import Application, ContextTypes, CommandHandler, MessageHandler, filters, CallbackContext
import os, logging
from dotenv import load_dotenv
import socketio

# Enable logging to bot.log
logging.basicConfig(
    filename='bot.log', level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
# set higher logging level for httpx to avoid all GET and POST requests being logged
logging.getLogger("httpx").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

load_dotenv()

# Replace 'YOUR_TOKEN' with your actual bot token
TOKEN = os.getenv('TOKEN')
locations = []

async def start(update: Update, context: CallbackContext):
    await update.message.reply_text('Stop! Who would cross into World of Quest must answer me one question only, but first share your live location for me and other travellers to see.')

    # Delete message after response
    await context.bot.delete_message(
        chat_id=update.message.chat_id,
        message_id=update.message.message_id
    )

async def init(update: Update, context: CallbackContext):

    # Get user to share their quest if they already shared location
    if update.message and update.message.location and update.message.location.live_period:
        await update.message.reply_text('With location known, to the main point we go - name your challenge. The more fun you offer, the more people will join your quest. Is there a reward for those who complete it? Write it out.')
        context.user_data['state'] = 'LOCATION_KNOWN'

    # Share live location and quest with API
    elif context.user_data.get('state') == 'LOCATION_KNOWN' and update.edited_message and update.edited_message.location:
        user_location = update.edited_message.location
        print(f'updated loc: {user_location}')
        # Create a Socket.IO client instance
        sio = socketio.Client()
        sio.connect(os.getenv('SERVER_URL' or 'http://localhost:3001'))
        sio.emit(
            'send_location', {
                'latitude': user_location.latitude, 
                'longitude': user_location.longitude,
                'live_period': user_location.live_period,
                'user_id': update.edited_message.from_user.id
            },
        )
    else:
        await update.message.reply_text('Please share your live location.')

async def error(update: Update, context: ContextTypes.DEFAULT_TYPE):
    print(f'Update {update} caused error {context.error}')
    logging.error(f'Update {update} caused error {context.error}')

if __name__ == '__main__':
    logging.info('Starting Questworld log...')
    print('Starting Questworld...')
    
    dp = Application.builder().token(TOKEN).build()
    dp.add_handler(CommandHandler("start", start))
    dp.add_handler(MessageHandler(filters.LOCATION, init))

    dp.run_polling(poll_interval=1)
    dp.add_error_handler(error)