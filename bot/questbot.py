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

async def handle_location(update: Update, context: CallbackContext):
    # When a user shares their location
    if update.edited_message.location:
        user_location = update.edited_message.location
        if context.user_data.get('state') != 'LOCATION_SHARED' and context.user_data.get('state') != 'QUEST_SHARED':
            await update.edited_message.reply_text('Great! With location known, to the main point we go - name your challenge. The more fun you offer, the more people will join your quest. Offering a reward? Write it out. 📜')
            context.user_data['state'] = 'LOCATION_SHARED'
        print(f'updated loc: {user_location}')
        print(context.user_data['state'])
        # Create a Socket.IO client instance if quest shared
        if context.user_data['state'] == 'QUEST_SHARED':
            print(f'sending data to server with quest: {context.user_data["quest"]}')
            sio = socketio.Client()
            sio.connect(os.getenv('SERVER_URL'))
            sio.emit(
                'send_location', {
                    'latitude': user_location.latitude, 
                    'longitude': user_location.longitude,
                    'live_period': user_location.live_period,
                    'user_id': update.edited_message.from_user.id,
                    'quest': context.user_data['quest'],
                    'username': update.edited_message.from_user.username
                },
            )
        else:
            # If the location is not live, request a live location
            await update.message.reply_text('Please share your live location.')


async def handle_quest(update: Update, context: CallbackContext):
    # When the user sends a follow-up message after sharing their location
    if update.message.text and context.user_data.get('state') == 'LOCATION_SHARED':
        context.user_data['quest'] = update.message.text  # Store the quest message
        await update.message.reply_text('Your quest has been shared to the world. Good luck on your journey.')
        context.user_data['state'] = 'QUEST_SHARED'
        print(context.user_data['state'])

async def handle_error(update: Update, context: CallbackContext):
    print(f'Update {update} caused error {context.error}')
    logging.error(f'Update {update} caused error {context.error}')
       

if __name__ == '__main__':
    logging.info('Starting Questworld log...')
    print('Starting Questworld...')
    
    dp = Application.builder().token(TOKEN).build()
    dp.add_handler(CommandHandler("start", start))
    dp.add_handler(MessageHandler(filters.LOCATION, handle_location))
    dp.add_handler(MessageHandler(filters.TEXT, handle_quest))
    

    dp.run_polling(poll_interval=1)
    dp.add_error_handler(handle_error)