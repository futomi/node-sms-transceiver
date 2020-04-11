/* ------------------------------------------------------------------
* node-sms-transceiver - open-cellid.js
*
* Copyright (c) 2020, Futomi Hatano, All rights reserved.
* Released under the MIT license
* Date: 2020-04-11
* ---------------------------------------------------------------- */
'use strict';
const mHttps = require('https');
const mUrl = require('url');

class OpenCellid {
  /* ------------------------------------------------------------------
  * Constructor
  *	
  * [Arguments]
  * - params     | Object   | Required |
  *   - token    | String   | Required | Your API token
  *   - region   | Integer  | Optional | Region code of the end point (1 - 4)
  *              |          |          | The default value is 1.
  *   - lang     | String   | Optional | Language code
  *              |          |          | The default value is "en"
  * 
  * The `region` must be one in the table below:
  * - 1: US East (Northern Virginia)
  * - 2: US West (San Francisco)
  * - 3: Europe (France)
  * - 4: Asia Pacific (Singapore)
  * ---------------------------------------------------------------- */
  constructor(params = {}) {
    // Check the `params`
    if (typeof (params) !== 'object') {
      throw new Error('The `params` must be an object.');
    }

    // Check the `token`
    let token = '';
    if ('token' in params) {
      token = params.token;
      if (!token || typeof (token) !== 'string') {
        throw new Error('The `token` must be a string.');
      }
    } else {
      throw new Error('The `token` is required.');
    }

    // Check the `region`
    let region = 1;
    if ('region' in params) {
      region = params.region;
      if (!region || typeof (region) !== 'number' || /^(1|2|3|4)$/.test(region.toString()) === false) {
        throw new Error('The `token` must be 1, 2, 3, or 4.');
      }
    }

    // Check the lang
    let lang = 'en';
    if ('lang' in params) {
      lang = params.lang;
      if (typeof (lang) !== 'string' || !(/^[a-zA-Z]{2}$/.test(lang) || /^[a-zA-Z]{2}\-[a-zA-Z]{2}$/.test(lang))) {
        throw new Error('The `lang` must be a language code such as "en", "en-US".');
      }
    }

    this._token = token;
    this._region = region;
    this._lang = lang;

    this._END_POINT_URLS = {
      1: 'https://us1.unwiredlabs.com/v2',
      2: 'https://us2.unwiredlabs.com/v2',
      3: 'https://eu1.unwiredlabs.com/v2',
      4: 'https://ap1.unwiredlabs.com/v2'
    };
    this._END_POINT_PATHS = {
      geolocation: '/process.php'
    };

    this._HTTP_REQUEST_TIMEOUT_MSEC = 5000; // msec
  }

  /* ------------------------------------------------------------------
  * geolocationCell1Gsm(params)
  * - Request to the Geolocation API (1 Cell - GSM)
  *
  * [Arguments]
  * - params     | Object   | Required |
  *   - mcc      | Integer  | Required | Mobile country code
  *   - mnc      | Integer  | Required | Mobile network code
  *   - lac      | Integer  | Required | Location area code
  *   - cid      | Integer  | Required | Cell ID,
  *
  *   {
  *     "mcc": 440,     // Mobile country code
  *     "mnc": 10,      // Mobile network code
  *     "lac": 4368,    // location area code
  *     "cid": 49983061 // Cell ID
  *   }
  * 
  * [Returen value]
  * - Promise object
  * - The response from OpenCelliD will be passed to the `resolve()`.
  * ---------------------------------------------------------------- */
  geolocationCell1Gsm(params = {}) {
    return (async () => {
      // Check the `params`
      if (typeof (params) !== 'object') {
        throw new Error('The `params` must be an object.');
      }
      // Check the `mcc`, `mnc`, `lac`, and `cid`
      let name_list = ['mcc', 'mnc', 'lac', 'cid'];
      for (let name of name_list) {
        if (!(name in params)) {
          throw new Error('The `' + name + '` is required.');
        }
        let v = params[name];
        if (!v || typeof (v) !== 'number' || v % 1 !== 0) {
          throw new Error('The `' + name + '` must be an integer grater than 0.');
        }
      }

      // Compose the post data
      let data = {
        'token': this._token,
        'radio': 'gsm',
        'mcc': params.mcc,
        'mnc': params.mnc,
        'cells': [
          {
            'lac': params.lac,
            'cid': params.cid
          }
        ],
        'address': 1,
        'accept-language': this._lang
      };

      // HTTP POST request
      let url = this._END_POINT_URLS[this._region] + this._END_POINT_PATHS.geolocation;
      let res = await this._httpPostRequest(url, data);
      return res;
    })();
  }

  _httpPostRequest(url_string, data) {
    return new Promise((resolve, reject) => {
      let url = mUrl.parse(url_string);

      let json = JSON.stringify(data);
      let opts = {
        protocol: 'https:',
        port: 443,
        method: 'POST',
        hostname: url.hostname,
        path: url.path,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': json.length
        }
      };

      let req = mHttps.request(opts, (res) => {
        res.setEncoding('utf8');
        let res_text = '';
        res.on('data', (chunk) => {
          res_text += chunk;
        });
        res.once('end', () => {
          try {
            let o = JSON.parse(res_text);
            resolve(o);
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(this._HTTP_REQUEST_TIMEOUT_MSEC, () => {
        req.abort();
        reject(new Error('TIMEOUT'));
      });

      req.write(json);
      req.end();
    });
  }

}

module.exports = OpenCellid;