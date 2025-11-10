from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import os
import secrets

app = Flask(__name__)
app.secret_key = secrets.token_hex(16)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Database Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    coins = db.Column(db.Integer, default=100)
    server_id = db.Column(db.Integer, db.ForeignKey('server.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Server(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    server_url = db.Column(db.String(500), nullable=False)
    server_type = db.Column(db.String(20), nullable=False)  # 'free', 'paid_5', 'paid_10', 'paid_15'
    is_occupied = db.Column(db.Boolean, default=False)
    occupied_by = db.Column(db.Integer, nullable=True)
    price = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Settings(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    logo_url = db.Column(db.String(500), default='')
    background_song_url = db.Column(db.String(500), default='')
    coin_deduction_rate = db.Column(db.Integer, default=1)  # coins deducted per minute

class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    amount = db.Column(db.Integer, nullable=False)
    server_id = db.Column(db.Integer, nullable=True)
    transaction_type = db.Column(db.String(50), nullable=False)  # 'purchase', 'deduction', 'refund'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Admin credentials
ADMIN_USERNAME = "Ntando"
ADMIN_PASSWORD = "Ntando"

# Initialize database
with app.app_context():
    db.create_all()
    # Create default settings if not exists
    if not Settings.query.first():
        default_settings = Settings()
        db.session.add(default_settings)
        db.session.commit()

# Helper Functions
def get_settings():
    settings = Settings.query.first()
    if not settings:
        settings = Settings()
        db.session.add(settings)
        db.session.commit()
    return settings

def allocate_free_server(user_id):
    """Allocate a free server to a user"""
    free_server = Server.query.filter_by(server_type='free', is_occupied=False).first()
    if free_server:
        free_server.is_occupied = True
        free_server.occupied_by = user_id
        user = User.query.get(user_id)
        user.server_id = free_server.id
        db.session.commit()
        return free_server
    return None

def deallocate_server(user_id):
    """Remove user from server"""
    user = User.query.get(user_id)
    if user and user.server_id:
        server = Server.query.get(user.server_id)
        if server:
            server.is_occupied = False
            server.occupied_by = None
        user.server_id = None
        db.session.commit()

def deduct_coins():
    """Background task to deduct coins from active users"""
    settings = get_settings()
    users = User.query.filter(User.server_id.isnot(None)).all()
    
    for user in users:
        if user.coins > 0:
            user.coins -= settings.coin_deduction_rate
            transaction = Transaction(
                user_id=user.id,
                amount=settings.coin_deduction_rate,
                server_id=user.server_id,
                transaction_type='deduction'
            )
            db.session.add(transaction)
        else:
            # User ran out of coins, deallocate server
            deallocate_server(user.id)
            flash(f'User {user.username} ran out of coins and was logged out.', 'warning')
    
    db.session.commit()

# Routes
@app.route('/')
def index():
    settings = get_settings()
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('index.html', settings=settings)

@app.route('/register', methods=['GET', 'POST'])
def register():
    settings = get_settings()
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        
        if not username or not password:
            flash('Username and password are required!', 'error')
            return redirect(url_for('register'))
        
        if password != confirm_password:
            flash('Passwords do not match!', 'error')
            return redirect(url_for('register'))
        
        if User.query.filter_by(username=username).first():
            flash('Username already exists!', 'error')
            return redirect(url_for('register'))
        
        hashed_password = generate_password_hash(password)
        new_user = User(username=username, password=hashed_password, coins=100)
        db.session.add(new_user)
        db.session.commit()
        
        # Auto-allocate free server
        server = allocate_free_server(new_user.id)
        
        session['user_id'] = new_user.id
        session['username'] = new_user.username
        
        if server:
            flash(f'Registration successful! Allocated to {server.name}', 'success')
        else:
            flash('Registration successful! No free servers available at the moment.', 'info')
        
        return redirect(url_for('dashboard'))
    
    return render_template('register.html', settings=settings)

@app.route('/login', methods=['GET', 'POST'])
def login():
    settings = get_settings()
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        user = User.query.filter_by(username=username).first()
        
        if user and check_password_hash(user.password, password):
            session['user_id'] = user.id
            session['username'] = user.username
            
            # Try to allocate server if user doesn't have one
            if not user.server_id and user.coins > 0:
                server = allocate_free_server(user.id)
                if server:
                    flash(f'Allocated to {server.name}', 'success')
                else:
                    flash('No free servers available. Please wait.', 'info')
            
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid username or password!', 'error')
    
    return render_template('login.html', settings=settings)

@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    settings = get_settings()
    user = User.query.get(session['user_id'])
    server = None
    
    if user.server_id:
        server = Server.query.get(user.server_id)
    
    return render_template('dashboard.html', user=user, server=server, settings=settings)

@app.route('/logout')
def logout():
    if 'user_id' in session:
        deallocate_server(session['user_id'])
    session.clear()
    flash('Logged out successfully!', 'success')
    return redirect(url_for('index'))

@app.route('/purchase_server/<int:server_id>', methods=['POST'])
def purchase_server(server_id):
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Not logged in'})
    
    user = User.query.get(session['user_id'])
    server = Server.query.get(server_id)
    
    if not server or server.is_occupied:
        return jsonify({'success': False, 'message': 'Server not available'})
    
    if server.server_type == 'free':
        return jsonify({'success': False, 'message': 'Free servers are auto-allocated'})
    
    if user.coins < server.price:
        return jsonify({'success': False, 'message': 'Insufficient coins'})
    
    # Deallocate current server
    if user.server_id:
        deallocate_server(user.id)
    
    # Purchase new server
    user.coins -= server.price
    server.is_occupied = True
    server.occupied_by = user.id
    user.server_id = server.id
    
    transaction = Transaction(
        user_id=user.id,
        amount=server.price,
        server_id=server.id,
        transaction_type='purchase'
    )
    db.session.add(transaction)
    db.session.commit()
    
    return jsonify({'success': True, 'message': f'Successfully purchased {server.name}'})

# Admin Routes
@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            session['admin'] = True
            flash('Admin login successful!', 'success')
            return redirect(url_for('admin_panel'))
        else:
            flash('Invalid admin credentials!', 'error')
    
    return render_template('admin_login.html')

@app.route('/admin/panel')
def admin_panel():
    if 'admin' not in session:
        return redirect(url_for('admin_login'))
    
    settings = get_settings()
    users = User.query.all()
    servers = Server.query.all()
    transactions = Transaction.query.order_by(Transaction.created_at.desc()).limit(50).all()
    
    return render_template('admin_panel.html', 
                         users=users, 
                         servers=servers, 
                         settings=settings,
                         transactions=transactions)

@app.route('/admin/add_server', methods=['POST'])
def add_server():
    if 'admin' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    name = request.form.get('name')
    server_url = request.form.get('server_url')
    server_type = request.form.get('server_type')
    
    price_map = {
        'free': 0,
        'paid_5': 5,
        'paid_10': 10,
        'paid_15': 15
    }
    
    new_server = Server(
        name=name,
        server_url=server_url,
        server_type=server_type,
        price=price_map.get(server_type, 0)
    )
    
    db.session.add(new_server)
    db.session.commit()
    
    flash(f'Server {name} added successfully!', 'success')
    return redirect(url_for('admin_panel'))

@app.route('/admin/delete_server/<int:server_id>', methods=['POST'])
def delete_server(server_id):
    if 'admin' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    server = Server.query.get(server_id)
    if server:
        # Free up users on this server
        users = User.query.filter_by(server_id=server_id).all()
        for user in users:
            user.server_id = None
        
        db.session.delete(server)
        db.session.commit()
        flash('Server deleted successfully!', 'success')
    
    return redirect(url_for('admin_panel'))

@app.route('/admin/update_settings', methods=['POST'])
def update_settings():
    if 'admin' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    settings = get_settings()
    settings.logo_url = request.form.get('logo_url', '')
    settings.background_song_url = request.form.get('background_song_url', '')
    settings.coin_deduction_rate = int(request.form.get('coin_deduction_rate', 1))
    
    db.session.commit()
    flash('Settings updated successfully!', 'success')
    return redirect(url_for('admin_panel'))

@app.route('/admin/add_coins/<int:user_id>', methods=['POST'])
def add_coins(user_id):
    if 'admin' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'})
    
    user = User.query.get(user_id)
    coins = int(request.form.get('coins', 0))
    
    if user and coins > 0:
        user.coins += coins
        db.session.commit()
        flash(f'Added {coins} coins to {user.username}', 'success')
    
    return redirect(url_for('admin_panel'))

@app.route('/admin/logout')
def admin_logout():
    session.pop('admin', None)
    flash('Admin logged out successfully!', 'success')
    return redirect(url_for('index'))

@app.route('/api/deduct_coins', methods=['POST'])
def api_deduct_coins():
    """API endpoint to trigger coin deduction (can be called by a cron job)"""
    deduct_coins()
    return jsonify({'success': True, 'message': 'Coins deducted'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
