/* ------------------------------------------------------------------
* node-sms-transceiver - sms-modem.js
*
* Copyright (c) 2020, Futomi Hatano, All rights reserved.
* Released under the MIT license
* Date: 2020-04-09
* ---------------------------------------------------------------- */
'use strict';
const EventEmitter = require('events');
const SerialPort = require('serialport');
const ValExp = require('node-oas-valexp');

class SmsModem extends EventEmitter {
  /* ------------------------------------------------------------------
  * Constructor
  *	
  * [Arguments]
  * - path       | String  | Required | System path of the serial port (e.g., "/dev/ttyMODEM0")
  * - options    | Object  | Optional |
  *   - baudRate | Integer | Optional | Baud rate. The Default is 115200.
  * ---------------------------------------------------------------- */
  constructor(path, options = {}) {
    super();

    // Check the `path`
    let valexp_path = new ValExp({
      name: 'path',
      required: true,
      schema: { type: 'string' }
    });
    if (!valexp_path.test(path)) {
      throw valexp_path.error;
    }

    // Check the `options`
    let valexp_options = new ValExp({
      name: 'options',
      schema: {
        type: 'object',
        properties: {
          baudRate: {
            type: 'integer',
            enum: [9600, 14400, 19200, 38400, 57600, 115200, 128000, 256000],
            default: 115200
          }
        }
      }
    });
    let valexp_options_res = valexp_options.exec(options);
    if (!valexp_options_res) {
      throw valexp_options.error;
    }
    let baud_rate = valexp_options_res[0].baudRate;

    // Create a SerialPort object
    this._port = new SerialPort(path, {
      autoOpen: false,
      baudRate: baud_rate
    });

    // Set the private properties
    this._path = path;
    this._baud_rate = baud_rate;
    this._onresponse = null;
    this._response_waiting = false;
    this._response_data = '';
  }

  get path() {
    return this._path;
  }

  get baudRate() {
    return this._baud_rate;
  }

  get isOpen() {
    return this._port.isOpen;
  }

  /* ------------------------------------------------------------------
  * open()
  * - Open the serial port
  *
  * [Arguments]
  * - None
  * 
  * [Returen value]
  * - Promise object
  * - Nothing will be passed to the `resolve()`.
  * ---------------------------------------------------------------- */
  open() {
    return new Promise((resolve, reject) => {
      if (!this._port) {
        this._port = new SerialPort(this._path, this._options);
      }
      if (this._port.isOpen === true) {
        resolve();
        return;
      }

      this._port.once('open', () => {
        this.emit('serial-open');
      });
      this._port.once('close', () => {
        this.emit('serial-close');
      });
      this._port.on('data', (buf) => {
        this._handleReceivedData(buf);
      });

      this._port.open((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });

    });
  }

  _handleReceivedData(buf) {
    let data = buf.toString('utf8');
    this.emit('serial-data', buf);

    data = this._trimFirstLastLineBreaks(data);

    if (this._response_waiting) {
      this._response_data += data;
      if (/(^|\n)(OK|ERROR)/.test(this._response_data) || /(^|\n)\> /.test(this._response_data)) {
        this._handleResponse(this._response_data);
        this._response_data = '';
      }
    } else {
      this._response_data = '';
      if (/^\+[A-Z0-9]{3,}\:/.test(data)) {
        this._receivedNotification(data);
      }
    }
  }

  _handleResponse(res) {
    this.emit('at-response', res);
    if (this._onresponse) {
      this._onresponse(res);
    }
  }

  _receivedNotification(data) {
    this.emit('at-notification', data);
    if (/^\+CMTI\:/.test(data)) {
      let [memr, index] = data.replace(/^\+CMTI\:\s*/, '').split(',');
      if (memr && index) {
        this.emit('sms-message', {
          memr: memr.replace(/^\"/, '').replace(/\"$/, ''),
          index: parseInt(index, 10)
        });
      }
    }
  }

  _trimFirstLastLineBreaks(data) {
    data = data.replace(/\x0d\x0a/g, '\n');
    data = data.replace(/\x0d/g, '\n');
    data = data.replace(/\x0a/g, '\n');
    data = data.replace(/^\n+/, '');
    data = data.replace(/\n+$/, '');
    return data;
  }

  /* ------------------------------------------------------------------
  * close()
  * - Close the serial port
  *
  * [Arguments]
  * - None
  * 
  * [Returen value]
  * - Promise object
  * - Nothing will be passed to the `resolve()`.
  * ---------------------------------------------------------------- */
  close() {
    return new Promise((resolve, reject) => {
      if (!this._port || this._port.isOpen === false) {
        resolve();
        return;
      }
      this._port.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /* ------------------------------------------------------------------
  * execCommand(cmd, options)
  * - Execute an AT command
  *
  * [Arguments]
  * - cmd          | String  | Required | AT command (e.g., "AT+COPS?")
  * - options      | Object  | Optional |
  *   - timeout    | Integer | Optional | Response timeout in msec.
  *                |         |          | The value must be in the range of 1 to 60000.
  *                |         |          | The default value is 10000.
  *   - terminator | Integer | Optional | Terminator character of AT command.
  *                |         |          | The default value is 0x0D (Carriage return).
  * 
  * [Returen value]
  * - Promise object
  * - A message coming from the modem will be passed to the `resolve()`.
  * - Even if the modem returns an error, the `resolve()` will be called.
  * ---------------------------------------------------------------- */
  execCommand(cmd, options = {}) {
    return new Promise((resolve, reject) => {
      // Check if the serial port is open
      if (this._port.isOpen === false) {
        reject(new Error('The serial port is closed.'));
        return;
      }

      // Check if the execution of the previous commnand had been finished or not
      if (this._response_waiting === true) {
        reject(new Error('The previous command has been active.'));
        return;
      }

      // Check the `cmd`
      let valexp_cmd = new ValExp({
        name: 'cmd',
        required: true,
        schema: { type: 'string' }
      });
      if (!valexp_cmd.test(cmd)) {
        reject(valexp_cmd.error);
        return;
      }

      // Check the `options`
      let valexp_options = new ValExp({
        name: 'options',
        schema: {
          type: 'object',
          properties: {
            timeout: { type: 'integer', minimum: 1, maximum: 60000, default: 10000 },
            terminator: { type: 'integer', minimum: 0, maximum: 0xff, default: 0x0d }
          }
        }
      });
      let valexp_options_res = valexp_options.exec(options);
      if (!valexp_options_res) {
        reject(valexp_options.error);
        return;
      }
      let timeout = valexp_options_res[0].timeout;
      let terminator = valexp_options_res[0].terminator;

      // Set a timer
      this._response_waiting = true;

      let timer = setTimeout(() => {
        timer = null;
        this._response_waiting = false;
        this._onresponse = null;
        let terminator_hex = Buffer.from([terminator]).toString('hex').toUpperCase();
        let msg = 'TIMEOUT: command=' + cmd + ', terminator=0x' + terminator_hex;
        reject(new Error(msg));
      }, timeout);

      // Set a event handler for receiving response
      this._onresponse = (res) => {
        this._onresponse = null;
        this._response_waiting = false;
        if (timer) {
          clearTimeout(timer);
          timer = null;
          resolve(res);
        }
      };

      // Send the command
      this._write(cmd, terminator).then(() => {
        // Do nothing
      }).catch((error) => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        this._onresponse = null;
        this._response_waiting = false;
        reject(error);
      });
    });
  }

  // Write an AT command to the serial port with a terminator (carriage return)
  _write(cmd, cr) {
    return new Promise((resolve, reject) => {
      let buf_at = Buffer.from(cmd);
      if (!cr) {
        cr = 0x0D;
      }
      let buf_cr = Buffer.from([cr]);
      let buf = Buffer.concat([buf_at, buf_cr]);
      this._port.write(buf, (error) => {
        if (error) {
          reject(error);
        } else {
          this.emit('at-command', cmd);
          resolve();
        }
      });
    });
  }

}

module.exports = SmsModem;