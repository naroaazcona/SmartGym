from flask import Flask, jsonify 
from flask_cors import CORS 
import os
 
app = Flask(__name__) 
CORS(app) 
 
@app.route('/health', methods=['GET']) 
def health_check(): 
    return jsonify({'message': 'Training service is running!'}) 


if __name__ == '__main__':
    debug = os.getenv('FLASK_DEBUG', '0') == '1'
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 5000)), debug=debug)
