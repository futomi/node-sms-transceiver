/* ------------------------------------------------------------------
* node-sms-transceiver - sms-transceiver.js
*
* Copyright (c) 2020, Futomi Hatano, All rights reserved.
* Released under the MIT license
* Date: 2020-04-11
* ---------------------------------------------------------------- */
'use strict';
const EventEmitter = require('events');
const ValExp = require('node-oas-valexp');
const SmsPdu = require('node-sms-pdu');
const SmsModem = require('./sms-modem.js');
const OpenCellid = require('./open-cellid.js');

class SmsTransceiver extends EventEmitter {
  /* ------------------------------------------------------------------
  * Constructor
  *	
  * [Arguments]
  * - path       | String  | Required | System path of the serial port (e.g., "/dev/ttyMODEM0")
  * - options    | Object  | Optional |
  *   - baudRate | Integer | Optional | Baud rate. The Default is 115200.
  * ---------------------------------------------------------------- */
  constructor(path, options) {
    super();
    this._modem = new SmsModem(path, options);
    this._concat = true;
    this._event_concat_messages = {};
  }

  get path() {
    return this._modem.path;
  }

  get baudRate() {
    return this._modem.baudRate;
  }

  get concat() {
    return this._concat;
  }

  set concat(flag) {
    let valexp = new ValExp({
      name: 'concat',
      required: true,
      schema: { type: 'boolean' }
    });
    if (valexp.test(flag)) {
      this._concat = flag;
    } else {
      throw valexp.error;
    }
  }

  /* ------------------------------------------------------------------
  * wait(msec) {
  * - Wait for the specified time (msec)
  *
  * [Arguments]
  * - msec | Integer | Required | Msec.
  *
  * [Returen value]
  * - Promise object
  * - Nothing will be passed to the `resolve()`.
  * ---------------------------------------------------------------- */
  wait(msec) {
    return new Promise((resolve, reject) => {
      let valexp_msec = new ValExp({
        name: 'msec',
        required: true,
        schema: { type: 'integer', minimum: 0 }
      });
      if (!valexp_msec.test(msec)) {
        reject(valexp_msec.error);
        return;
      }
      setTimeout(resolve, msec);
    });
  }

  /* ------------------------------------------------------------------
  * open()
  * - Opens the serial port and sets the configurations
  *
  * [Arguments]
  * - None
  * 
  * [Returen value]
  * - Promise object
  * - Nothing will be passed to the `resolve()`.
  * ---------------------------------------------------------------- */
  open() {
    return (async () => {
      if (this._modem.isOpen === true) {
        return;
      }

      this._modem.once('serial-open', () => {
        this.emit('serial-open');
      });

      this._modem.once('serial-close', () => {
        this._modem.removeAllListeners();
        this.emit('serial-close');
      });

      this._modem.on('serial-data', (buf) => {
        this.emit('serial-data', buf);
      });

      this._modem.on('at-command', (cmd) => {
        this.emit('at-command', cmd);
      });

      this._modem.on('at-response', (res) => {
        this.emit('at-response', res);
      });

      this._modem.on('at-notification', (notification) => {
        this.emit('at-notification', notification);
      });

      this._modem.on('sms-message', (notification) => {
        this._handleSmsMessageEvent(notification);
      });

      await this._modem.open();

      let cmd_list = [
        'ATE0', // Command Echo: Disable
        'ATQ0', // Quiet Result Codes: Enable
        'ATV1', // Response Format: full headers and trailers and verbose format of result codes
        'ATS0=0', // Number Of Rings To Auto Answer: auto answer disabled
        'AT+CNMI=2,1,0,0,0', // New Message Indications To Terminal Equipment: Enable indications
        'AT+CMGF=0' // Message Format: PDU mode
      ];
      for (let cmd of cmd_list) {
        await this._modem.execCommand(cmd);
      }
    })();
  }

  _handleSmsMessageEvent(notification) {
    (async () => {
      let index = notification.index;
      let msg = await this._readMessage(index);
      if (!msg.concat || this._concat === false) {
        this.emit('sms-message', msg);
        return;
      }

      let key = [
        msg.type,
        msg.from || msg.to,
        msg.concat.reference,
        msg.concat.total
      ].join('-');

      if (!(key in this._event_concat_messages)) {
        let texts = [];
        let indexes = [];

        for (let i = 0; i < msg.concat.total; i++) {
          indexes.push(undefined);
          texts.push(undefined);
        }

        this._event_concat_messages[key] = {
          indexes: indexes,
          texts: texts,
          message: msg,
          total: msg.concat.total,
          num: 0
        };
      }

      let idx = msg.concat.sequence - 1;
      let cmsg = this._event_concat_messages[key];
      cmsg.indexes[idx] = msg.index;
      cmsg.texts[idx] = msg.text;
      cmsg.num++;

      if (cmsg.num === cmsg.total) {
        cmsg.message.text = cmsg.texts.join('');
        delete cmsg.message.concat.sequence;
        cmsg.message.concat.indexes = cmsg.indexes;
        this.emit('sms-message', cmsg.message);
        delete this._event_concat_messages[key];
        return;
      }

    })().catch((error) => {
      console.error(error);
    });
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
    return this._modem.close();
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
  execCommand(cmd, options) {
    return this._modem.execCommand(cmd, options);
  }

  /* ------------------------------------------------------------------
  * getModemInfo()
  * - Get the information of the modem
  *
  * [Arguments]
  * - None
  * 
  * [Returen value]
  * - Promise object
  * - An object will be passed to the `resolve()`:
  *   {
  *     "manufacturer": "SIMCOM INCORPORATED",
  *     "model": "SIMCOM_SIM7100JC",
  *     "revision": "4534B05SIM7100JC",
  *     "serial": "866803000000000"
  *   }
  * ---------------------------------------------------------------- */
  getModemInfo() {
    return (async () => {
      // Manufacturer Identification
      let cgmi_res = await this.execCommand('AT+CGMI');
      let cgmi = this._trimLastOkLine(cgmi_res);

      // Model Identification
      let cgmm_res = await this.execCommand('AT+CGMM');
      let cgmm = this._trimLastOkLine(cgmm_res);

      // Revision Identification
      let cgmr_res = await this.execCommand('AT+CGMR');
      cgmr_res = this._trimLastOkLine(cgmr_res);
      let cgmr = cgmr_res.replace(/^\+CGMR\:\s*/, '');

      // Product Serial Number Identification
      let cgsn_res = await this.execCommand('AT+CGSN');
      let cgsn = this._trimLastOkLine(cgsn_res);

      let info = {
        manufacturer: cgmi,
        model: cgmm,
        revision: cgmr,
        serial: cgsn
      };

      return info;
    })();
  }

  /* ------------------------------------------------------------------
  * getNetworkInfo()
  * - Get the information of the network
  *
  * [Arguments]
  * - None
  * 
  * [Returen value]
  * - Promise object
  * - An object will be passed to the `resolve()`:
  *   {
  *     "subscriber": "08000000000",
  *     "operator": {
  *       "name": "NTT DOCOMO NTT DOCOMO",
  *       "mcc": 440, // Mobile country code
  *       "mnc": 10  // Mobile network code
  *     },
  *     "pdpContexts": [ // PDP (Packet Data Protocol) contexts
  *       {
  *         "id": "1",
  *         "type": "IP", // PDP type ("IP" or "PPP")
  *         "apn": "lte.exemple.ne.jp", // Access Point Name
  *         "active": true,
  *         "addr": "0.0.0.0", // PDP address
  *       }
  *     ]
  *   }
  * ---------------------------------------------------------------- */
  getNetworkInfo() {
    return (async () => {
      // Subscriber Number
      let cnum_res = await this.execCommand('AT+CNUM');
      cnum_res = this._trimLastOkLine(cnum_res);
      let cnum_rows = this._parseCsvResponseLine('CNUM', cnum_res);
      let cnum = '';
      if (cnum_rows && cnum_rows.length >= 2) {
        cnum = cnum_rows[1];
      }

      // Operator Selection
      let operator = {
        name: '',
        mcc: 0, // Mobile country code
        mnc: 0 // Mobile network code
      };

      await this.execCommand(`AT+COPS=3,0`);
      let cops0_res = await this.execCommand('AT+COPS?');
      let cops0_data = this._parseCops(cops0_res);
      if (cops0_data) {
        operator.name = cops0_data.oper;
      }

      await this.execCommand(`AT+COPS=3,2`);
      let cops2_res = await this.execCommand('AT+COPS?');
      let cops2_data = this._parseCops(cops2_res);
      if (cops2_data) {
        operator.mcc = parseInt(cops2_data.oper.substring(0, 3), 10);
        operator.mnc = parseInt(cops2_data.oper.substring(3, 5), 10);
      }

      // PDP contexts
      let cgdcont_res = await this.execCommand('AT+CGDCONT?');
      let contexts = this._parseCgdcont(cgdcont_res);

      // PDP Context Activate Or Deactivate
      let cgact_res = await this.execCommand('AT+CGACT?');
      let context_acts = this._parseCgact(cgact_res);
      for (let [cid, active] of Object.entries(context_acts)) {
        if (contexts[cid]) {
          contexts[cid].active = active;
        }
      }

      // Show PDP Address 
      let cgpaddr_res = await this.execCommand('AT+CGPADDR=' + Object.keys(contexts).join(','));
      let context_addrs = this._parseCgpaddr(cgpaddr_res);
      for (let [cid, addr] of Object.entries(context_addrs)) {
        if (contexts[cid]) {
          contexts[cid].addr = addr;
        }
      }

      let info = {
        subscriber: cnum,
        operator: operator,
        contexts: Object.values(contexts)
      };

      return info;
    })();
  }

  _parseCops(data) {
    let ln = this._trimLastOkLine(data);
    let rows = this._parseCsvResponseLine('COPS', ln);
    if (!rows || rows.length < 3) {
      return null;
    }

    let res = {
      mode: rows[0],
      format: rows[1],
      oper: rows[2]
    };
    return res;
  }

  _parseCgdcont(data) {
    data = this._trimLastOkLine(data);
    let lines = data.split(/\n+/);
    let res = {};
    for (let ln of lines) {
      let rows = this._parseCsvResponseLine('CGDCONT', ln);
      if (!rows || rows.length < 3) {
        continue;
      }
      let id = rows[0];
      res[id] = {
        cid: rows[0], // context identifier
        type: rows[1],
        apn: rows[2]
      };
    }
    return res;
  }

  _parseCgact(data) {
    data = this._trimLastOkLine(data);
    let lines = data.split(/\n+/);
    let res = {};
    for (let ln of lines) {
      let rows = this._parseCsvResponseLine('CGACT', ln);
      if (!rows || rows.length < 2) {
        continue;
      }
      let cid = rows[0];
      let active = (rows[1] === '1') ? true : false;
      res[cid] = active;
    }
    return res;
  }

  _parseCgpaddr(data) {
    data = this._trimLastOkLine(data);
    let lines = data.split(/\n+/);
    let res = {};
    for (let ln of lines) {
      let rows = this._parseCsvResponseLine('CGPADDR', ln);
      if (!rows || rows.length < 2) {
        continue;
      }
      let cid = rows[0];
      let addr = rows[1];
      res[cid] = addr;
    }
    return res;
  }

  _trimLastOkLine(data) {
    data = data.replace(/\n+OK$/, '');
    return data;
  }

  _parseCsvResponseLine(cmd, line) {
    let prefix_re = new RegExp('^\\+' + cmd + '\\:\\s*');
    if (prefix_re.test(line) === false) {
      return null;
    }
    line = line.replace(prefix_re, '');

    let cols = [];
    let is_in_quoted_col = false;
    let col = '';
    let chars = line.split('');

    for (let char of chars) {
      if (char === ',') {
        if (!is_in_quoted_col) {
          cols.push(col);
          col = '';
          continue;
        }
      } else if (char === '"') {
        is_in_quoted_col = !is_in_quoted_col;
        continue;
      }
      col += char;
    }
    if (col) {
      cols.push(col);
    }

    return cols;
  }

  /* ------------------------------------------------------------------
  * getSignalQuality()
  * - Get the Signal Quality
  *
  * [Arguments]
  * - None
  * 
  * [Returen value]
  * - Promise object
  * - An object will be passed to the `resolve()`:
  *   {
  *     "rssi": -67,
  *     "ber": null
  *   }
  * 
  * ber:
  * - 0: less than 0.2%
  * - 1: 0.2% to 0.4%
  * - 2: 0.4% to 0.8%
  * - 3: 0.8% to 1.6%
  * - 4: 1.6% to 3.2%
  * - 5: 3.2% to 6.4%
  * - 6: 6.4% to 12.8%
  * - 7: more than 12.8%
  * - null: Unknown
  * ---------------------------------------------------------------- */
  getSignalQuality() {
    return (async () => {
      // Signal Quality
      let csq = await this.execCommand('AT+CSQ');
      csq = this._trimLastOkLine(csq);
      let regexp = /^\+CSQ\:\s*/;

      let res = {
        rssi: null,
        ber: null
      };

      if (regexp.test(csq)) {
        let [rssi, ber] = csq.replace(regexp, '').split(',');

        if (/^\d+$/.test(rssi)) {
          rssi = parseInt(rssi, 10);
          if (rssi === 0) {
            rssi = -113; // -113 dBm or less 
          } else if (rssi >= 1 && rssi <= 30) {
            rssi = -113 + (rssi * 2); // in the range of -111 to -53 dBm
          } else if (rssi = 31) {
            rssi = -51; // -51 dBm or greater 
          } else {
            rssi = null; // not known or not detectable
          }
          res.rssi = rssi;
        }

        if (/^\d+$/.test(ber)) {
          res.ber = parseInt(ber, 10);
        }
      }

      return res;
    })();
  }

  /* ------------------------------------------------------------------
  * getLocationInfo()
  * - Get the information of the location
  *
  * [Arguments]
  * - params       | Object  | Optional |
  *   - opencellid | Object  | Optional |
  *     - token    | String  | Required | Your API token
  *     - region   | Integer | OPtional | Region code of the end point (1 - 4)
  *                |         |          | The default value is 1.
  *     - lang     | String  | Optional | Language code
  *                |         |          | The default value is "en"
  * 
  * The `region` must be one in the table below:
  * - 1: US East (Northern Virginia)
  * - 2: US West (San Francisco)
  * - 3: Europe (France)
  * - 4: Asia Pacific (Singapore)
  * 
  * [Returen value]
  * - Promise object
  * - An object will be passed to the `resolve()`:
  *   {
  *     "mcc": 440,     // Mobile country code
  *     "mnc": 10,      // Mobile network code
  *     "lac": 4368,    // location area code
  *     "cid": 49983061 // Cell ID
  *   }
  * - If the `opencellid` is specified and the `opencellid` property
  *   will be added in the response as follows:
  *   {
  *     "mcc": 440,      // Mobile country code
  *     "mnc": 10,       // Mobile network code
  *     "lac": 4368,     // location area code
  *     "cid": 49983061, // Cell ID
  *     "opencellid": {
  *       "status": "ok",
  *       "balance": 4999,
  *       "lat": 35.814246,
  *       "lon": 139.395624,
  *       "accuracy": 905,
  *       "message": "This cell tower was not found in OpenCelliD. ...",
  *       "address": "Iruma, Saitama Prefecture, 358-0011, Japan"
  *     }
  *   }
  * ---------------------------------------------------------------- */
  getLocationInfo(params = {}) {
    return (async () => {
      // Check the `params`
      if (typeof (params) !== 'object') {
        throw new Error('The `params` must be an object.');
      }

      // Set the presentation of an unsolicited result code of `AT +CREG?`
      let creg2_res = await this.execCommand('AT+CREG=2');
      if (/(^|\n)OK/.test(creg2_res) === false) {
        throw new Error('Unexpected response: ' + creg2_res);
      }

      // Get the location
      let creg_res = await this.execCommand('AT+CREG?');
      let creg_res_line = this._trimLastOkLine(creg_res);
      let rows = this._parseCsvResponseLine('CREG', creg_res_line);
      if (!rows || rows.length < 4) {
        return null;
      }

      let lac_hex = rows[2];
      let cid_hex = rows[3];
      if (!lac_hex || /^[0-9A-Fa-f]{4}$/.test(lac_hex) === false) {
        throw new Error('Unexpected response: ' + creg_res_line);
      }
      if (!cid_hex || /^[0-9A-Fa-f]+$/.test(cid_hex) === false) {
        throw new Error('Unexpected response: ' + creg_res_line);
      }
      let lac = parseInt(lac_hex, 16);
      let cid = parseInt(cid_hex, 16);

      // Operator Selection
      await this.execCommand(`AT+COPS=3,2`);
      let cops2_res = await this.execCommand('AT+COPS?');
      let cops2_data = this._parseCops(cops2_res);
      if (!cops2_data) {
        throw new Error('Failed to execute the command: AT+COPS?');
      }
      let mcc = parseInt(cops2_data.oper.substring(0, 3), 10);
      let mnc = parseInt(cops2_data.oper.substring(3, 5), 10);

      let info = {
        mcc: mcc, // Mobile country code
        mnc: mnc, // Mobile network code
        lac: lac, // location area code
        cid: cid  // Cell ID
      };

      // OpenCelliD
      if (params.opencellid) {
        let poci = params.opencellid;
        let newp = {
          token: poci.token,
        };
        if (poci.region) {
          newp.region = poci.region;
        }
        if (poci.lang) {
          newp.lang = poci.lang;
        }
        let opencellid = new OpenCellid(newp);
        let res = await opencellid.geolocationCell1Gsm({
          mcc: mcc,
          mnc: mnc,
          lac: lac,
          cid: cid,
        });
        info.opencellid = res;
      }

      return info;
    })();
  }

  /* ------------------------------------------------------------------
  * getMessageStorage()
  * - Get the preferred message storage
  *
  * [Arguments]
  * - None
  * 
  * [Returen value]
  * - Promise object
  * - An object will be passed to the `resolve()`:
  *   {
  *     "r": {
  *       "mem": "ME",
  *       "total": 8,
  *       "used": 23
  *     },
  *     "w": {
  *       "mem": "ME",
  *       "total": 8,
  *       "used": 23
  *     },
  *     "s": {
  *       "mem": "ME",
  *       "total": 8,
  *       "used": 23
  *     }
  *   }
  * ---------------------------------------------------------------- */
  getMessageStorage() {
    return (async () => {
      // Preferred Message Storage 
      let cpms_res = await this.execCommand('AT+CPMS?');
      cpms_res = this._trimLastOkLine(cpms_res);
      let rows = this._parseCsvResponseLine('CPMS', cpms_res);
      if (!rows || rows.length < 9) {
        throw new Error('Unexpected response: ' + cpms_res);
      }

      let res = {
        r: { mem: '', used: 0, total: 0 },
        w: { mem: '', used: 0, total: 0 },
        s: { mem: '', used: 0, total: 0 }
      };

      ['r', 'w', 's'].forEach((k, i) => {
        // memr, memw, mems
        res[k].mem = rows[i * 3 + 0];
        // usedr, usedw, useds
        res[k].used = parseInt(rows[i * 3 + 1], 10);
        // totalr, totalw, totals
        res[k].total = parseInt(rows[i * 3 + 2], 10);
      });
      return res;
    })();
  }

  /* ------------------------------------------------------------------
  * setMessageStorage(memr, memw, mems)
  * - Set the preferred message storage
  *
  * [Arguments]
  * - memr    | String  | Required | Memory type for reading messages.
  * - memw    | String  | Optional | Memory type for writing and sending messages.
  * - mems    | String  | Optional | Memory type for storing received messages.
  *
  * Each argument must be "SM" or "ME" if specified.
  * If the `memw` and `mems` are not specified, the values are set to the value of the `memr`.
  * 
  * [Returen value]
  * - Promise object
  * - An object will be passed to the `resolve()`:
  *   {
  *     "r": {
  *       "mem": "ME",
  *       "total": 8,
  *       "used": 23
  *     },
  *     "w": {
  *       "mem": "ME",
  *       "total": 8,
  *       "used": 23
  *     },
  *     "s": {
  *       "mem": "ME",
  *       "total": 8,
  *       "used": 23
  *     }
  *   }
  * ---------------------------------------------------------------- */
  setMessageStorage(memr, memw, mems) {
    return (async () => {
      // Check the `memr`, `memw`, `mems`
      if (!memr) {
        throw new Error('The `memr` is required.');
      }
      let params = {
        memr: memr,
        memw: memw || memr,
        mems: mems || memr
      };
      for (let [k, v] of Object.entries(params)) {
        let valexp = new ValExp({
          name: k,
          schema: { type: 'string', enum: ['SM', 'ME'] }
        });
        if (!valexp.test(v)) {
          throw valexp.error;
        }
      }

      // Preferred Message Storage
      let command = `AT+CPMS="${memr}","${memw}","${mems}"`;
      let cpms = await this.execCommand(command);

      if (/\nOK/.test(cpms) === false) {
        throw new Error('Unexpected response: ' + cpms);
      }

      let res = await this.getMessageStorage();
      return res;
    })();
  }

  /* ------------------------------------------------------------------
  * listMessages(options)
  * - List messages stored in the selected message storage
  *
  * [Arguments]
  * - options  | Object  | Optional |
  *   - stat   | Integer | Optional | Message status
  *            |         |          | See the description below
  *
  * The `stat` must be one in the table below: 
  * - 0: new message
  * - 1: read message
  * - 2: stored message not yet sent
  * - 3: stored message already sent
  * - 4: all messages (Default)
  *
  * [Returen value]
  * - Promise object
  * - An array will be passed to the `resolve()`:
  *   [
  *     {
  *       "index": 0,
  *       "stat": 1,
  *       "concat": null;
  *       "number": "09000000000",
  *       "text": "Hello",
  *       "pdus": [{
  *         "smsc": "+8190000000000",
  *         "type": "SMS-DELIVER",
  *         "origination": "09000000000",
  *         "timestamp": "2020-02-21T14:07:06+09:00",
  *         "concat": null,
  *         "text": "Hello"
  *       }:
  *     }
  *   ]
  * ---------------------------------------------------------------- */
  listMessages(options = {}) {
    return (async () => {
      let valexp_options = new ValExp({
        name: 'options',
        schema: {
          type: 'object',
          properties: {
            stat: { type: 'integer', enum: [0, 1, 2, 3, 4], default: 4 }
          }
        }
      });
      let valexp_options_res = valexp_options.exec(options);
      if (!valexp_options_res) {
        throw valexp_options.error;
      }
      options = valexp_options_res[0];

      // List Messages
      let command = 'AT+CMGL=' + options.stat.toString();
      let cmgl = await this.execCommand(command);
      if (/(^|\n)OK/.test(cmgl) === false) {
        throw new Error('Unexpected response: ' + cmgl);
      }

      let message_list = this._parseMessageList(cmgl);
      return message_list;
    })();
  }

  _parseMessageList(cmgl) {
    let line_list = cmgl.split(/\n+/);
    let message_list = [];
    let current_message = null;
    let concat_num = 0;

    for (let line of line_list) {
      if (/^\+CMGL\:/.test(line)) {
        let rows = this._parseCsvResponseLine('CMGL', line);
        if (rows.length < 2) {
          continue;
        }

        let index = parseInt(rows[0], 10);
        let stat = parseInt(rows[1], 10);

        current_message = {
          index: index,
          stat: stat,
          type: '',
          from: null,
          to: null,
          date: null,
          concat: null,
          text: ''
        };

      } else if (current_message && /^[A-F0-9]+$/.test(line)) {
        let pdu = SmsPdu.parse(line);
        delete pdu.details;
        current_message.type = pdu.type;

        if (pdu.type === 'SMS-DELIVER') {
          current_message.from = pdu.origination;
          current_message.date = pdu.timestamp;
        } else if (pdu.type === 'SMS-SUBMIT') {
          current_message.to = pdu.destination;
        }

        if (pdu.concat) {
          current_message.concat = {
            reference: pdu.concat.reference,
            sequence: pdu.concat.sequence,
            total: pdu.concat.total
          };
          concat_num++;
        }
        current_message.text = pdu.text;
        message_list.push(current_message);
      } else {
        current_message = null;
      }
    }

    // Sort the messages by `index`
    message_list.sort((a, b) => {
      return (a.index > b.index) ? 1 : -1;
    });

    // Merge concatinated messages
    if (this._concat === true && concat_num > 0) {
      message_list = this._mergeMessageList(message_list);
    }

    return message_list;
  }

  _mergeMessageList(message_list) {
    let merged_list = [];
    let concat_msg_map = {};

    for (let msg of message_list) {
      if (!msg.concat) {
        merged_list.push(msg);
        continue;
      }

      let key = [
        msg.type,
        msg.from || msg.to,
        msg.concat.reference,
        msg.concat.total
      ].join('-');

      if (!(key in concat_msg_map)) {
        let texts = [];
        let indexes = [];

        for (let i = 0; i < msg.concat.total; i++) {
          indexes.push(undefined);
          texts.push(undefined);
        }

        concat_msg_map[key] = {
          indexes: indexes,
          texts: texts,
          message: msg,
          total: msg.concat.total,
          num: 0
        };
        merged_list.push(msg);
      }

      let idx = msg.concat.sequence - 1;
      concat_msg_map[key].indexes[idx] = msg.index;
      concat_msg_map[key].texts[idx] = msg.text;
      concat_msg_map[key].num++;

      if (concat_msg_map[key].num === concat_msg_map[key].total) {
        let message = concat_msg_map[key].message;
        message.text = concat_msg_map[key].texts.join('');
        delete message.concat.sequence;
        message.concat.indexes = concat_msg_map[key].indexes;
        delete concat_msg_map[key];
      }
    }

    for (let concat_msg of Object.values(concat_msg_map)) {
      let merged_text = '';
      for (let txt of concat_msg.texts) {
        if (txt === undefined) {
          txt = '[?]'
        }
        merged_text += txt;
      }
      concat_msg.message.text = merged_text;
      delete concat_msg.message.concat.sequence;
      concat_msg.message.concat.indexes = concat_msg.indexes;
    }

    return merged_list;
  }

  /* ------------------------------------------------------------------
  * readMessage(index)
  * - Read a message stored in the currnet message storage
  *
  * [Arguments]
  * - index | integer | Required | index number in the current message storage
  *
  * [Returen value]
  * - Promise object
  * - An object will be passed to the `resolve()`:
  *   {
  *     "index": 0,
  *     "stat": 1,
  *     "data": {
  *       "smsc": "+8190000000000",
  *       "type": "SMS-DELIVER",
  *       "origination": "09000000000",
  *       "timestamp": "2020-02-21T14:07:06+09:00",
  *       "concat": null,
  *       "text": "Hello"
  *     }
  *   }
  * - If the specified `index` is not available, `null` will be passed 
  *   to the `resolve()`.
  * ---------------------------------------------------------------- */
  readMessage(index) {
    return (async () => {
      let msg = await this._readMessage(index);
      if (!msg) {
        return null;
      }
      if (!msg.concat || this._concat === false) {
        return msg;
      }

      let message_list = await this.listMessages();
      let target_message = null;
      for (let message of message_list) {
        if (message.index === index) {
          target_message = message;
          break;
        }
      }

      return target_message;
    })();
  }

  _readMessage(index) {
    return (async () => {
      let valexp_index = new ValExp({
        name: 'index',
        required: true,
        schema: { type: 'integer', minimum: 0 }
      });
      if (!valexp_index.test(index)) {
        throw valexp_index.error;
      }

      // Read Message
      let command = 'AT+CMGR=' + index.toString();
      let cmgr_res = await this.execCommand(command);
      if (/(^|\n)OK/.test(cmgr_res) === false) {
        throw new Error('Unexpected response: ' + cmgr_res);
      }
      cmgr_res = this._trimLastOkLine(cmgr_res);
      let lines = cmgr_res.split(/\n+/);

      if (/^\+CMGR\:/.test(lines[0]) === false || /^[A-F0-9]+$/.test(lines[1]) === false) {
        return null;
      }

      let rows = this._parseCsvResponseLine('CMGR', lines[0]);
      let stat = parseInt(rows[0], 10);

      let pdu = SmsPdu.parse(lines[1]);

      let msg = {
        index: index,
        stat: stat,
        type: pdu.type,
        from: null,
        to: null,
        date: null,
        concat: null,
        text: pdu.text
      };

      if (pdu.concat) {
        msg.concat = {
          reference: pdu.concat.reference,
          sequence: pdu.concat.sequence,
          total: pdu.concat.total
        };
      }

      if (pdu.type === 'SMS-DELIVER') {
        msg.from = pdu.origination;
        msg.date = pdu.timestamp;
      } else if (pdu.type === 'SMS-SUBMIT') {
        msg.to = pdu.destination;
      }

      return msg;
    })();
  }

  /* ------------------------------------------------------------------
  * deleteMessage(index)
  * - Delete a message stored in the currnet message storage
  *
  * [Arguments]
  * - index   | Integer | Required | Index number in the current message storage.
  *
  * [Returen value]
  * - Promise object
  * - An object will be passed to the `resolve()`:
  *   {
  *     "index": 0,
  *     "stat": 1,
  *     "data": {
  *       "smsc": "+8190000000000",
  *       "type": "SMS-DELIVER",
  *       "origination": "09000000000",
  *       "timestamp": "2020-02-21T14:07:06+09:00",
  *       "concat": null,
  *       "text": "Hello"
  *     }
  *   }
  * - If the specified `index` is not available, `null` will be passed 
  *   to the `resolve()`.
  * ---------------------------------------------------------------- */
  deleteMessage(index) {
    return (async () => {
      let valexp_index = new ValExp({
        name: 'index',
        required: true,
        schema: { type: 'integer', minimum: 0 }
      });
      if (!valexp_index.test(index)) {
        throw valexp_index.error;
      }

      // Read Message
      let msg = await this.readMessage(index);
      if (!msg) {
        return null;
      }

      // Delete Message
      // - in the case that the message is not a concatenated message
      //   or the concat mode is disabled
      if (!msg.concat || this._concat === false) {
        let command = 'AT+CMGD=' + index.toString();
        let cmgd = await this.execCommand(command);
        if (/(^|\n)OK/.test(cmgd) === false) {
          throw new Error('Unexpected response: ' + cmgr);
        }
        return msg;
      }

      // Delete Messages
      // - in the case that the message is a concatenated message
      //   and the concat mode is enabled
      let message_list = await this.listMessages();
      let target_message = null;
      for (let message of message_list) {
        if (message.index === index) {
          target_message = message;
          break;
        }
      }
      if (!target_message) {
        return null;
      }
      for (let idx of target_message.concat.indexes) {
        let command = 'AT+CMGD=' + idx.toString();
        let cmgd = await this.execCommand(command);
        if (/(^|\n)OK/.test(cmgd) === false) {
          throw new Error('Unexpected response: ' + cmgr);
        }
      }
      return target_message;
    })();
  }

  /* ------------------------------------------------------------------
  * deleteAllMessages()
  * - Delete all messages stored in the currnet message storage
  *
  * [Arguments]
  * - None
  *
  * [Returen value]
  * - Promise object
  * - Nothing will be passed to the `resolve()`:
  * ---------------------------------------------------------------- */
  deleteAllMessages() {
    return (async () => {
      // Delete All Messages
      let command = 'AT+CMGD=0,4';
      let cmgd = await this.execCommand(command);
      if (/(^|\n)OK/.test(cmgd)) {
        return;
      } else {
        throw new Error('Unexpected response: ' + cmgr);
      }
    })();
  }

  /* ------------------------------------------------------------------
  * sendMessage(dest, text)
  * - Send a message to the specified telephone number
  *
  * [Arguments]
  * - dest    | String | Required | Destination telephone number
  * - text    | String | Required | Message text
  *
  * [Returen value]
  * - Promise object
  * - Nothing will be passed to the `resolve()`:
  * ---------------------------------------------------------------- */
  sendMessage(dest, text) {
    return (async () => {
      // Create PDUs
      let pdu_list = this._generateSubmitPdus(dest, text);

      // Send Message
      let err = '';

      for (let pdu of pdu_list) {
        let command = 'AT+CMGS=' + pdu.length;
        let cmgs = await this.execCommand(command);
        if (/^\>/.test(cmgs)) {
          let result = await this.execCommand(pdu.hex, {
            terminator: 0x1A  // `0x1A` means "Ctrl+z"
          });
          if (/(^|\n)OK/.test(result) === false) {
            err = 'Unexpected response: ' + result;
            break;
          }
        } else {
          err = 'Unexpected response: ' + cmgs;
          break;
        }
      }

      if (err) {
        throw new Error(err);
      }

      return;
    })();
  }

  _generateSubmitPdus(dest, text) {
    let valexp_dest = new ValExp({
      name: 'dest',
      required: true,
      schema: { type: 'string', pattern: /^\+?\d+$/ }
    });
    if (!valexp_dest.test(dest)) {
      throw valexp_dest.error;
    }

    let valexp_text = new ValExp({
      name: 'text',
      required: true,
      schema: { type: 'string', minLength: 1 }
    });
    if (!valexp_text.test(text)) {
      throw valexp_text.error;
    }

    // Create PDUs
    let pdu_list = SmsPdu.generateSubmit(dest, text);
    return pdu_list;
  }

  /* ------------------------------------------------------------------
  * writeSubmitMessage(dest, text)
  * - Write a SMS-SUBMIT message to the selected storage
  *
  * [Arguments]
  * - dest    | String | Required | Destination telephone number
  * - text    | String | Required | Message text
  *
  * [Returen value]
  * - Promise object
  * - A list of the stored message index number will be passed to the `resolve()`:
  * ---------------------------------------------------------------- */
  writeSubmitMessage(dest, text) {
    return (async () => {
      // Create PDUs
      let pdu_list = this._generateSubmitPdus(dest, text);

      // Write the PDUs to the selected storage
      let err = '';
      let index_list = [];

      for (let pdu of pdu_list) {
        let command = 'AT+CMGW=' + pdu.length.toString() + ',2';
        let cmgw_res = await this.execCommand(command);
        if (/^\>/.test(cmgw_res) === false) {
          err = 'Unexpected response: ' + cmgw_res;
          break;
        }
        let result = await this.execCommand(pdu.hex, {
          terminator: 0x1A  // `0x1A` means "Ctrl+z"
        });
        if (/(^|\n)OK/.test(result) === false) {
          err = 'Unexpected response: ' + result;
          break;
        }
        result = this._trimLastOkLine(result);
        let rows = this._parseCsvResponseLine('CMGW', result);
        if (!rows || rows.length < 1 || /^\d+$/.test(rows[0]) === false) {
          err = 'Unexpected response: ' + result;
          break;
        }

        let parsed_pud = SmsPdu.parse(pdu.hex);
        delete parsed_pud.details;

        index_list.push(parseInt(rows[0], 10));
      }

      if (err) {
        throw new Error(err);
      }

      return index_list;
    })();
  }

  /* ------------------------------------------------------------------
  * sendStoredMessage(index)
  * - Send a SMS-SUBMIT message stored in the selected storage
  *
  * [Arguments]
  * - index   | Integer | Required | Message index number or
  *
  * [Returen value]
  * - Promise object
  * - Nothing will be passed to the `resolve()`:
  * ---------------------------------------------------------------- */
  sendStoredMessage(index) {
    return (async () => {
      // Check the `index`
      let valexp_index = new ValExp({
        name: 'index',
        required: true,
        schema: { type: 'integer', minimum: 0 }
      });
      if (!valexp_index.test(index)) {
        throw valexp_index.error;
      }

      // Read the message
      let message = await this.readMessage(index);
      if (!message) {
        throw new Error('The `index` was not found.');
      }

      let index_list = [index];
      if (message.concat && this._concat === true) {
        index_list = message.concat.indexes;
      }

      // Send the message
      for (let idx of index_list) {
        let command = 'AT+CMSS=' + idx.toString();
        let cmss_res = await this.execCommand(command);
        if (/(^|\n)OK/.test(cmss_res) === false) {
          throw new Error('Unexpected response: ' + cmss_res);
        }
      }
    })();
  }

}

module.exports = SmsTransceiver;