node-sms-transceiver
===============

The node-sms-transceiver sends and receives SMS messages via a GSM modem.

This module communicates with GSM modem (LTE/3G module, etc.) connected to a serial port on the host device. It supports receiving/sending SMS messages, reading/writing SMS messages in the memory storage of the LTE module. This module also supports concatenated SMS. It merges such divided messages and shows them as one message.

The main purpose of this module is handling SMS messages, while it supports additional functionalities such as getting the modem information, network information of LTE network. Besides it can report the latitude/longitude and the physical address of the cell tower of the mobile phone operator thanks to [OpenCelliD](http://www.opencellid.org/).

The node-sms-transceiver communicates with the GSM modem using AT-commands. As you know, AT-command support of GSM modems is not completely compatible. This module might not work well on your GSM modem. The node-sms-transceiver was tested with LTE modules as follows:

- [Quectel EC25-J Mini PCIe](https://www.quectel.com/product/ec25minipcie.htm)
- [SIMCom SIM7100JC](https://www.simcom.com/product/SIM7100X.html) (Sending concatenated SMS messages did not work well)

The tested mobile phone operator is only [NTT docomo](https://en.wikipedia.org/wiki/NTT_Docomo) for now, which is the predominant mobile phone operator in Japan. I'm not sure that the node-sms-transceiver works well in the world. I'm happy to hear your comments.

## Dependencies

* [Node.js](https://nodejs.org/en/) 10 +
* [serialport](https://github.com/serialport/node-serialport)
* [node-sms-pdu](https://github.com/futomi/node-sms-pdu)
* [node-oas-valexp](https://github.com/futomi/node-oas-valexp)

## Installation

```
$ cd ~
$ npm install node-sms-transceiver
```

---------------------------------------
## Table of Contents

* [Quick Start](#Quick-Start)
  * [Send a message](#Quick-Start-1)
  * [Read all messages](#Quick-Start-2)
  * [Receive messages in real time](#Quick-Start-3)
* [`SmsTransceiver` object](#SmsTransceiver-object)
  * [Creating `SmsTransceiver` object](#Creating-SmsTransceiver-object)
  * [Properties](#SmsTransceiver-properties)
  * [Events](#SmsTransceiver-events)
  * [`open()` method](#SmsTransceiver-open-method)
  * [`close()` method](#SmsTransceiver-close-method)
  * [`getModemInfo()` method](#SmsTransceiver-getModemInfo-method)
  * [`getNetworkInfo()` method](#SmsTransceiver-getNetworkInfo-method)
  * [`getSignalQuality()` method](#SmsTransceiver-getSignalQuality-method)
  * [`getLocationInfo()` method](#SmsTransceiver-getLocationInfo-method)
  * [`getMessageStorage()` method](#SmsTransceiver-getMessageStorage-method)
  * [`setMessageStorage()` method](#SmsTransceiver-setMessageStorage-method)
  * [`listMessages()` method](#SmsTransceiver-listMessages-method)
  * [`readMessage()` method](#SmsTransceiver-readMessage-method)
  * [`deleteMessage()` method](#SmsTransceiver-deleteMessage-method)
  * [`deleteAllMessages()` method](#SmsTransceiver-deleteAllMessages-method)
  * [`sendMessage()` method](#SmsTransceiver-sendMessage-method)
  * [`writeSubmitMessage()` method](#SmsTransceiver-writeSubmitMessage-method)
  * [`sendStoredMessage()` method](#SmsTransceiver-sendStoredMessage-method)
* [Release Note](#Release-Note)
* [References](#References)
* [License](#License)

---------------------------------------
## <a id="Quick-Start">Quick Start</a>

### <a id="Quick-Start-1">Send a message</a>

The code below shows how to send a SMS message.

```javascript
const SmsTransceiver = require('node-sms-transceiver');
const smstransceiver = new SmsTransceiver('/dev/ttyMODEM0');

(async () => {
  // Open the serial port
  await smstransceiver.open();
  // Send a message
  await smstransceiver.sendMessage('09000000000', 'Cheers!');
  // Close the serial port
  await smstransceiver.close();
})();

```

As you can see in the code above, a [`SmsTransceiver`](#SmsTransceiver-object) object (variable `smstransceiver`) is created with the path of the serial port (`"/dev/ttyMODEM0"`). Then the serial port is opened using the [`open()`](#SmsTransceiver-open-method) method of the [`SmsTransceiver`](#SmsTransceiver-object) object, a message `"Cheers!"` is sent to the destination phone number (`"09000000000"`) using the [`sendMessage()`](#SmsTransceiver-sendMessage-method) method. Finally, the serial port is closed using the [`close()`](#SmsTransceiver-close-method) method. Your friend would receive the message in a few seconds.

### <a id="Quick-Start-2">Read all messages</a>

Incoming SMS messages are stored in the LTE module or SIM card. The code below shows how to read the stored messages.

```javascript
const SmsTransceiver = require('node-sms-transceiver');
const smstransceiver = new SmsTransceiver('/dev/ttyMODEM0');

(async () => {
  // Open the serial port
  await smstransceiver.open();
  // Get the all messages stored in the LTE module or the SIM card
  let message_list = await smstransceiver.listMessages();
  // Show the reslt
  console.log(JSON.stringify(message_list, null, '  '));
  // Close the serial port
  await smstransceiver.close();
})();
```

You can get the stored messages using the [`listMessage()`](#SmsTransceiver-listMessages-method) method of the [`SmsTransceiver`](#SmsTransceiver-object) object. The code above will output the result as follows:

```
[
  {
    "index": 0,
    "stat": 0,
    "type": "SMS-DELIVER",
    "from": "09000000000",
    "to": null,
    "date": "2020-04-10T22:47:30+09:00",
    "concat": null,
    "text": "Hello. How are you?"
  },
  {
    "index": 1,
    "stat": 0,
    "type": "SMS-DELIVER",
    "from": "09000000000",
    "to": null,
    "date": "2020-04-10T22:48:39+09:00",
    "concat": null,
    "text": "Thank you. Take care."
  }
]
```

### <a id="Quick-Start-3">Receive messages in real time</a>

The code below shows how to receive SMS messages in real time.

```javascript
const SmsTransceiver = require('node-sms-transceiver');
const smstransceiver = new SmsTransceiver('/dev/ttyMODEM0');

(async () => {
  // Open the serial port
  await smstransceiver.open();

  // Set the listener for the `sms-message` event
  smstransceiver.on('sms-message', async (data) => {
    // Show the received message
    console.log('A message was received:');
    console.log(JSON.stringify(data, null, '  '));
  });
})();
```

The code above will output the result as follows:

```
A message was received:
{
  "index": 11,
  "stat": 0,
  "type": "SMS-DELIVER",
  "from": "09000000000",
  "to": null,
  "date": "2020-04-11T00:16:47+09:00",
  "concat": null,
  "text": "Hello"
}
```

---------------------------------------
## <a id="SmsTransceiver-object">`SmsTransceiver` object</a>

### <a id="Creating-SmsTransceiver-object">Creating `SmsTransceiver` object</a>

In order to use this module, you have to get the `SmsTransceiver` constructor loading this module as follows:

```JavaScript
const SmsTransceiver = require('node-sms-transceiver');
```

In the code snippet above, the variable `SmsTransceiver` is a `SmsTransceiver` constructor. 

Then, you have to create a `SmsTransceiver` object from the constructor as follows:

```javascript
const smstransceiver = new SmsTransceiver('/dev/ttyMODEM0');
```

The path of the serial port must be passed to the constructor. Optionally, you can specify the baud rate as follows:

```javascript
const smstransceiver = new SmsTransceiver('/dev/ttyMODEM0', { baudRate: 115200 });
```

The default value of the `baudRate` is `115200`. The `baudRate` accepts `9600`, `14400`, `19200`, `38400`, `57600`, `115200`, `128000`, or `256000`.

### <a id="SmsTransceiver-properties">Properties</a>

The `SmsTransceiver` object supports some properties as follows:

Property   | Type    | r/w | Description
:----------|:--------|:----|:-----------------
`path`     | String  | r   | Path of the serial port which was passed to the constructor.
`baudRate` | Integer | r   | Baud rate of the serial port which was passed to the constructor.
`concat`   | Boolean | r/w | Concatenated SMS support flag. The default is `true`.

In the table above, "r" means that the property is readable, "w" means that the property is writable.

If the `concat` is set to `false`, this module does not support concatenated SMS messages, that is, it does not treat such divided messages as one message. You have to merge such divided messages to one message by yourself.

### <a id="SmsTransceiver-events">Events</a>

Some events will be fired on the `SmsTransceiver` object.

#### <a id="SmsTransceiver-events-serial-open">`serial-open` event</a>

The `serial-open` event will be fired when the serial port is opened. Nothing will be passed to the callback function.

```javascript
const SmsTransceiver = require('node-sms-transceiver');
const smstransceiver = new SmsTransceiver('/dev/ttyMODEM0');

smstransceiver.on('serial-open', () => {
  console.log('The `serial-open` event was fired.');
});
smstransceiver.on('serial-close', () => {
  console.log('The `serial-close` event was fired.');
});

(async () => {
  await smstransceiver.open();
  await smstransceiver.close();
})();
```

The code above will output the result as follows:

```
The `serial-open` event was fired.
The `serial-close` event was fired.
```

#### <a id="SmsTransceiver-events-serial-close">`serial-close` event</a>

The `serial-open` event will be fired when the serial port is closed. Nothing will be passed to the callback function. See the section ["`serial-open` event"](#SmsTransceiver-events-serial-open) for details.

#### <a id="SmsTransceiver-events-serial-data">`serial-data` event</a>

The `serial-data` event will be fired when data is received from the serial port. A `Buffer` object will be passed to the callback function. The object represents a response of an AT command or a notification.

```javascript
const SmsTransceiver = require('node-sms-transceiver');
const smstransceiver = new SmsTransceiver('/dev/ttyMODEM0');

smstransceiver.on('serial-data', (buffer) => {
  console.log('[serial-data]');
  console.log(buffer);
  console.log(buffer.toString('utf8'));
});

(async () => {
  await smstransceiver.open();
  await smstransceiver.close();
})();
```

The code above will output the result as follows:

```
[serial-data]
<Buffer 0d 0a 4f 4b 0d 0a>

OK

[serial-data]
<Buffer 0d 0a 4f 4b 0d 0a>

OK
...
```

This event is mainly used for debugging. If you want see the communication with the modem, it is recommended to listen to the [`at-command`](#SmsTransceiver-events-at-command), [`at-response`](#SmsTransceiver-events-at-response), and [`at-notification`](#SmsTransceiver-events-at-notification) events.

#### <a id="SmsTransceiver-events-at-command">`at-command` event</a>

The `at-command` event will be fired when this module sends a AT-command to the modem. The AT-command will be passed to the callback function. With the [`at-response`](#SmsTransceiver-events-at-response) event, you can see all communication with the modem.

```javascript
const SmsTransceiver = require('node-sms-transceiver');
const smstransceiver = new SmsTransceiver('/dev/ttyMODEM0');

smstransceiver.on('at-command', (command) => {
  console.log('[at-command] ' + command);
});

smstransceiver.on('at-response', (response) => {
  console.log('[at-response] ' + response);
});

(async () => {
  await smstransceiver.open();
  await smstransceiver.close();
})();
```

The code above will output the result as follows:

```
[at-command] ATE0
[at-response] OK
[at-command] ATQ0
[at-response] OK
[at-command] ATV1
[at-response] OK
[at-command] ATS0=0
[at-response] OK
[at-command] AT+CNMI=2,1,0,0,0
[at-response] OK
[at-command] AT+CMGF=0
[at-response] OK
```

#### <a id="SmsTransceiver-events-at-response">`at-response` event</a>

The `at-response` event will be fired when this module receives a response from the modem. The response data will be passed to the callback function. The preceding line breaks and trailing line breaks in the response will be trimmed. 

See the section ["`at-command` event"](#SmsTransceiver-events-at-command) for details.

#### <a id="SmsTransceiver-events-at-notification">`at-notification` event</a>

The `at-notification` will be fired when a notification from the modem is caught. The notification data will be passed to the callback function. The preceding line breaks and trailing line breaks in the notification will be trimmed. 

```javascript
const SmsTransceiver = require('node-sms-transceiver');
const smstransceiver = new SmsTransceiver('/dev/ttyMODEM0');

smstransceiver.on('at-notification', (notification) => {
  console.log('[at-notification] ' + notification);
});

smstransceiver.open();
```

When a notification is received, the code above will output the result as follows:

```
[at-notification] +CSQ: 24,99
```

Note that this module is agnostic on the meaning of the notification. It just passes notifications from the modem to you.

#### <a id="SmsTransceiver-events-sms-message">`sms-message` event</a>

The `sms-message` event will fired when a SMS message is received. The [`SmsMessage`](#SmsMessage-object) object representing the received message will be passed to the callback function.

```javascript
const SmsTransceiver = require('node-sms-transceiver');
const smstransceiver = new SmsTransceiver('/dev/ttyMODEM0');

smstransceiver.on('sms-message', (message) => {
  console.log(JSON.stringify(message, null, '  '));
});

smstransceiver.open();
```

When a SMS message is received, the code above will output the result as follows:

```
{
  "index": 15,
  "stat": 0,
  "type": "SMS-DELIVER",
  "from": "09000000000",
  "to": null,
  "date": "2020-04-11T09:48:08+09:00",
  "concat": null,
  "text": "Hello"
}
```

### <a id="SmsTransceiver-open-method">`open()` method</a>

The `open()` method opens the serial port. This method returns a `Promise` object. Nothing will be passed to the `resolve()`.

See the sample codes in the previous sections for details.

### <a id="SmsTransceiver-close-method">`close()` method</a>

The `close()` method closes the serial port. This method returns a `Promise` object. Nothing will be passed to the `resolve()`.

See the sample codes in the previous sections for details.

### <a id="SmsTransceiver-getModemInfo-method">`getModemInfo()` method</a>

The `getModemInfo()` method retrieves the modem information. This method returns a `Promise` object. An object representing the information will be passed to the `resolve()`. The object contains the properties as follows:

Property       | Type    | Description
:--------------|:--------|:-------------------------
`manufacturer` | String  | Manufacturer identification code
`model`        | String  | Model identification code
`revision`     | String  | Software revision number
`serial`       | String  | Product serial number

```javascript
const SmsTransceiver = require('node-sms-transceiver');
const smstransceiver = new SmsTransceiver('/dev/ttyMODEM0');

(async () => {
  await smstransceiver.open();
  let modem_info = await smstransceiver.getModemInfo();
  console.log(JSON.stringify(modem_info, null, '  '));
  await smstransceiver.close();
})();
```

the code above will output the result as follows:

```
{
  "manufacturer": "SIMCOM INCORPORATED",
  "model": "SIMCOM_SIM7100JC",
  "revision": "4534B05SIM7100JC",
  "serial": "000000000000000"
}
```

### <a id="SmsTransceiver-getNetworkInfo-method">`getNetworkInfo()` method</a>

The `getNetworkInfo()` method retrieves the mobile network information from modem. This method returns a `Promise` object. An object representing the informatiion will be passed to the `resolve()`. The object contains the properties as follows:

Property                         | Type    | Description
:--------------------------------|:--------|:-------------------------
`subscriber`                     | String  | Subscriber Number
`operator`                       | Object  | Operator Selection
&nbsp;&nbsp;&nbsp;&nbsp;`name`   | String  | Operator name
&nbsp;&nbsp;&nbsp;&nbsp;`mcc`    | Integer | [Mobile Country Code (MCC)](https://en.wikipedia.org/wiki/Mobile_country_code)
&nbsp;&nbsp;&nbsp;&nbsp;`mnc`    | Integer | [Mobile Network Code (MNC)](https://en.wikipedia.org/wiki/Mobile_country_code)
`contexts`                       | Array   | PDP (Packet Data Protocol) contexts
&nbsp;&nbsp;&nbsp;&nbsp;`cid`    | String  | PDP Context Identifier
&nbsp;&nbsp;&nbsp;&nbsp;`type`   | String  | Packet Data Protocol type
&nbsp;&nbsp;&nbsp;&nbsp;`apn`    | String  | Access Point Name
&nbsp;&nbsp;&nbsp;&nbsp;`active` | String  | State of the PDP context activation (`true`: activated, `false`: deactivated)
&nbsp;&nbsp;&nbsp;&nbsp;`addr`   | String  | PDP addresses for the PDP context

```javascript
const SmsTransceiver = require('node-sms-transceiver');
const smstransceiver = new SmsTransceiver('/dev/ttyMODEM0');

(async () => {
  await smstransceiver.open();
  let network_info = await smstransceiver.getNetworkInfo();
  console.log(JSON.stringify(network_info, null, '  '));
  await smstransceiver.close();
})();
```

the code above will output the result as follows:

```
{
  "subscriber": "08000000000",
  "operator": {
    "name": "NTT DOCOMO NTT DOCOMO",
    "mcc": 440,
    "mnc": 10
  },
  "contexts": [
    {
      "cid": "1",
      "type": "IP",
      "apn": "lte-d.ocn.ne.jp",
      "active": true,
      "addr": "10.251.240.29"
    }
  ]
}
```

### <a id="SmsTransceiver-getSignalQuality-method">`getSignalQuality()` method</a>

The `getSignalQuality()` method retrieves the current signal quality. This method returns a `Promise` object. An object representing the information will be passed to the `resolve()`. The object contains the properties as follows:

Property | Type    | Description
:--------|:--------|:-------------------------
`rssi`   | Integer | Received signal strength indication (dBm)
`ber`    | Integer | Bit error rate level

The meanings of the level of the `ber` is as follows:

- `0`: less than 0.2%
- `1`: 0.2% to 0.4%
- `2`: 0.4% to 0.8%
- `3`: 0.8% to 1.6%
- `4`: 1.6% to 3.2%
- `5`: 3.2% to 6.4%
- `6`: 6.4% to 12.8%
- `7`: more than 12.8%
- `99` not known or not detectable

```javascript
const SmsTransceiver = require('node-sms-transceiver');
const smstransceiver = new SmsTransceiver('/dev/ttyMODEM0');

(async () => {
  await smstransceiver.open();
  let signal_quality = await smstransceiver.getSignalQuality();
  console.log(JSON.stringify(signal_quality, null, '  '));
  await smstransceiver.close();
})();
```

the code above will output the result as follows:

```
{
  "rssi": -65,
  "ber": 99
}
```

### <a id="SmsTransceiver-getLocationInfo-method">`getLocationInfo()` method</a>

The `getLocationInfo()` method retrieves the information of the mobile cell from the network registration report. This method returns a `Promise` object. An object representing the information will be passed to the `resolve()`. The object contains the properties as follows:

Property | Type    | Description
:--------|:--------|:-------------------------
`mcc`    | Integer | [Mobile Country Code (MCC)](https://en.wikipedia.org/wiki/Mobile_country_code)
`mnc`    | Integer | [Mobile Network Code (MNC)](https://en.wikipedia.org/wiki/Mobile_country_code)
`lac`    | Integer | Local Area Code of the mobile operator's network
`cid`    | Integer | Cell ID

```javascript
const SmsTransceiver = require('node-sms-transceiver');
const smstransceiver = new SmsTransceiver('/dev/ttyMODEM0');

(async () => {
  await smstransceiver.open();
  let location_info = await smstransceiver.getLocationInfo();
  console.log(JSON.stringify(location_info, null, '  '));
  await smstransceiver.close();
})();
```

the code above will output the result as follows:

```
{
  "mcc": 440,
  "mnc": 10,
  "lac": 65534,
  "cid": 49680722
}
```

This method can report the latitude/longitude and the physical address of the cell tower of the mobile carrier thanks to [OpenCelliD](http://www.opencellid.org/). Sign up for [OpenCelliD](http://www.opencellid.org/) and get your API token in advance.

This method supports an argument optionally. If an object described in the table blow is passed to this method, this method asks OpenCeliD the physical address.

Property     | Type    | Required | Description
:------------|:--------|:---------|:---------------------
`opencellid` | Object  | Optional | &nbsp;
&nbsp;&nbsp;&nbsp;&nbsp;`token`  | String  | Required | Your API token
&nbsp;&nbsp;&nbsp;&nbsp;`region` | Integer | Optional | Region code of the end point (1 - 4). The default is `1`.
&nbsp;&nbsp;&nbsp;&nbsp;`lang`   | String  | Optional | Language code. The default value is `"en"`.

The `region` must be one in the table below:
- `1`: US East (Northern Virginia) (default)
- `2`: US West (San Francisco)
- `3`: Europe (France)
- `4`: Asia Pacific (Singapore)

```javascript
const SmsTransceiver = require('node-sms-transceiver');
const smstransceiver = new SmsTransceiver('/dev/ttyMODEM0');

(async () => {
  await smstransceiver.open();
  let location_info = await smstransceiver.getLocationInfo({
    opencellid: {
      token: 'XXXXXXXXXXXXXX' // Replace with your token
    }
  });
  console.log(JSON.stringify(location_info, null, '  '));
  await smstransceiver.close();
})();
```

the code above will output the result as follows:

```
{
  "mcc": 440,
  "mnc": 10,
  "lac": 65534,
  "cid": 49680722,
  "opencellid": {
    "status": "ok",
    "balance": 4998,
    "lat": 35.816087,
    "lon": 139.399214,
    "accuracy": 932,
    "message": "This cell tower was not found in OpenCelliD. However, we served a location from the Unwired Labs LocationAPI (unwiredlabs.com), an Enterprise Geolocation service with over 100 million cell towers.",
    "address": "Iruma, Saitama Prefecture, 358-0011, Japan"
  }
}
```

The data of the `opencellid` property is the response of the Geolocation API with no change. See [the document of OpenCelliD](https://unwiredlabs.com/api) for details.

### <a id="SmsTransceiver-getMessageStorage-method">`getMessageStorage()` method</a>

SMS messages are stored in a memory storage. Usually, your LTE module supports two types of storage: SIM SMS memory storage and ME (GSM Mobile Equipment) internal storage. The `getMessageStorage()` method reports the selected preferred message storage. This method returns a `Promise` object. An object representing the information will be passed to the `resolve()`. The object contains the properties as follows:

Property                        | Type    | Description
:-------------------------------|:--------|:-------------------------
`r`                             | Object  | Information of the memory storage for reading
&nbsp;&nbsp;&nbsp;&nbsp;`mem`   | String  | `"SM"`: SIM SMS memory storage, `"ME"`: ME internal storage
&nbsp;&nbsp;&nbsp;&nbsp;`used`  | Integer | Number of messages stored in the storage
&nbsp;&nbsp;&nbsp;&nbsp;`total` | Integer | Maximum number of messages which the storage can save
`w`                             | Object  | Information of the memory storage for writing
&nbsp;&nbsp;&nbsp;&nbsp;`mem`   | String  | `"SM"`: SIM SMS memory storage, `"ME"`: ME internal storage
&nbsp;&nbsp;&nbsp;&nbsp;`used`  | Integer | Number of messages stored in the storage
&nbsp;&nbsp;&nbsp;&nbsp;`total` | Integer | Maximum number of messages which the storage can save
`s`                             | Object  | Information of the memory storage for storing received messages
&nbsp;&nbsp;&nbsp;&nbsp;`mem`   | String  | `"SM"`: SIM SMS memory storage, `"ME"`: ME internal storage
&nbsp;&nbsp;&nbsp;&nbsp;`used`  | Integer | Number of messages stored in the storage
&nbsp;&nbsp;&nbsp;&nbsp;`total` | Integer | Maximum number of messages which the storage can save


```javascript
const SmsTransceiver = require('node-sms-transceiver');
const smstransceiver = new SmsTransceiver('/dev/ttyMODEM0');

(async () => {
  await smstransceiver.open();
  let storage_info = await smstransceiver.getMessageStorage();
  console.log(JSON.stringify(storage_info, null, '  '));
  await smstransceiver.close();
})();
```

the code above will output the result as follows:

```
{
  "r": {
    "mem": "ME",
    "used": 16,
    "total": 23
  },
  "w": {
    "mem": "ME",
    "used": 16,
    "total": 23
  },
  "s": {
    "mem": "ME",
    "used": 16,
    "total": 23
  }
}
```

### <a id="SmsTransceiver-setMessageStorage-method">`setMessageStorage()` method</a>

The `setMessageStorage` method selects the preferred message storage. This method returns a `Promise` object. This method takes three arguments:

No.  | Type   | Required | Description
:----|:-------|:---------|:------------------------
1st  | String | Required | Memory storage type for reading messages.
2nd  | String | Optional | Memory storage type for writing and sending messages.
3rd  | String | Optional | Memory storage type for storing received messages 

Every argument must be `"SM"` or `"ME"`. If the 2nd and 3rd arguments are omitted, they will be set to the value of 1st argument.

If this method successfully selects the preferred message storage, the information of the newly selected preferred storage will be passed to the `resolve()`. The information is as same as the result of the [`getMessageStorage()`](#SmsTransceiver-getMessageStorage-method).

```javascript
const SmsTransceiver = require('node-sms-transceiver');
const smstransceiver = new SmsTransceiver('/dev/ttyMODEM0');

(async () => {
  await smstransceiver.open();
  let storage_info = await smstransceiver.setMessageStorage('ME', 'ME', 'ME');
  console.log(JSON.stringify(storage_info, null, '  '));
  await smstransceiver.close();
})();
```

the code above will output the result as follows:

```
{
  "r": {
    "mem": "ME",
    "used": 16,
    "total": 23
  },
  "w": {
    "mem": "ME",
    "used": 16,
    "total": 23
  },
  "s": {
    "mem": "ME",
    "used": 16,
    "total": 23
  }
}
```

### <a id="SmsTransceiver-listMessages-method">`listMessages()` method</a>

The `listMessages()` method reads the stored messages. This method returns a `Promise` object. This method takes a hash object as an argument containing properties as follows:

Property | Type    | Required | Description
:--------|:--------|:---------|:------------------------
`stat`   | Integer | Optional | Message status (`0` - `4`). The default is `4`.

The `stat` must be an integer in the range of `0` to `4`. The meaning of each value is as follows:

- 0: new message
- 1: read message
- 2: stored message not yet sent
- 3: stored message already sent
- 4: all messages (Default)

This method passes an `Array` object containing [`SmsMessage`](#SmsMessage-object) objects representing the SMS messages.

The code below reads new messages (i.e., messages which have not been read yet):

```javascript
const SmsTransceiver = require('node-sms-transceiver');
const smstransceiver = new SmsTransceiver('/dev/ttyMODEM0');

(async () => {
  await smstransceiver.open();
  let message_list = await smstransceiver.listMessages({ stat: 0 });
  console.log(JSON.stringify(message_list, null, '  '));
  await smstransceiver.close();
})();
```

the code above will output the result as follows:

```
[
  {
    "index": 16,
    "stat": 0,
    "type": "SMS-DELIVER",
    "from": "09000000000",
    "to": null,
    "date": "2020-04-11T14:43:10+09:00",
    "concat": null,
    "text": "Hello. How are you?"
  },
  {
    "index": 17,
    "stat": 0,
    "type": "SMS-DELIVER",
    "from": "09000000000",
    "to": null,
    "date": "2020-04-11T14:43:21+09:00",
    "concat": null,
    "text": "Thank you. Take care."
  }
]
```

Note that the `stat` of a received message will change from `0` to `1` once it is read. If this module encounters a concatenated message, it reads all messages in order to merge separated messages. That is, the value of the `stat` of message you have never read could be `1`.

### <a id="SmsTransceiver-readMessage-method">`readMessage()` method</a>

The `readMessage()` method reads a stored message. This method returns a `Promise` object. This method takes an index number of the target message. If this method successfully read the message, a [`SmsMessage`](#SmsMessage-object) object representing the target message will be passed to the `resolve()`. If the specified index number was not found, `null` will be passed to the `resolve()`.

```javascript
const SmsTransceiver = require('node-sms-transceiver');
const smstransceiver = new SmsTransceiver('/dev/ttyMODEM0');

(async () => {
  await smstransceiver.open();
  let message = await smstransceiver.readMessage(16);
  console.log(JSON.stringify(message, null, '  '));
  await smstransceiver.close();
})();
```

the code above will output the result as follows:

```
{
  "index": 16,
  "stat": 1,
  "type": "SMS-DELIVER",
  "from": "09000000000",
  "to": null,
  "date": "2020-04-11T14:43:10+09:00",
  "concat": null,
  "text": "Hello. How are you?"
}
```

### <a id="SmsTransceiver-deleteMessage-method">`deleteMessage()` method</a>

The `deleteMessage()` method deletes a message from the storage. This method returns a `Promise` object. This method takes an index number of the target message. If this method successfully delete the message, a [`SmsMessage`](#SmsMessage-object) object representing the target message will be passed to the `resolve()`. If the specified index number was not found, `null` will be passed to the `resolve()`.

```javascript
const SmsTransceiver = require('node-sms-transceiver');
const smstransceiver = new SmsTransceiver('/dev/ttyMODEM0');

(async () => {
  await smstransceiver.open();
  let msg = await smstransceiver.deleteMessage(16);
  console.log(JSON.stringify(msg, null, '  '));
  await smstransceiver.close();
})();
```

the code above will output the result as follows:

```
{
  "index": 16,
  "stat": 1,
  "type": "SMS-DELIVER",
  "from": "09000000000",
  "to": null,
  "date": "2020-04-11T14:43:10+09:00",
  "concat": null,
  "text": "Hello. How are you?"
}
```

### <a id="SmsTransceiver-deleteAllMessages-method">`deleteAllMessages()` method</a>

The `deleteAllMessages()` method deletes all message stored in the storage. This method returns a `Promise` object. Nothing will be passed to the `resolve()`.

```javascript
const SmsTransceiver = require('node-sms-transceiver');
const smstransceiver = new SmsTransceiver('/dev/ttyMODEM0');

(async () => {
  await smstransceiver.open();
  await smstransceiver.deleteAllMessages();
  await smstransceiver.close();
})();
```

### <a id="SmsTransceiver-sendMessage-method">`sendMessage()` method</a>

The `sendMessage()` method sends a SMS message directly without storing it in the storage. This method takes two arguments:

No.  | Type   | Required | Description
:----|:-------|:---------|:------------------------
1st  | String | Required | Destination telephone number
2nd  | String | Required | Message text

This method returns a `Promise` object. Nothing will be passed to the `resolve()`.

```javascript
const SmsTransceiver = require('node-sms-transceiver');
const smstransceiver = new SmsTransceiver('/dev/ttyMODEM0');

(async () => {
  await smstransceiver.open();
  await smstransceiver.sendMessage('09000000000', 'Hello!');
  await smstransceiver.close();
})();
```

### <a id="SmsTransceiver-writeSubmitMessage-method">`writeSubmitMessage()` method</a>

The `writeSubmitMessage()` method save a SMS message in the preferred message storage. This method takes two arguments:

No.  | Type   | Required | Description
:----|:-------|:---------|:------------------------
1st  | String | Required | Destination telephone number
2nd  | String | Required | Message text

This method returns a `Promise` object. An `Array` object will be passed to the `resolve()`. The `Array` object contains index number(s) of the stored message(s).

```javascript
const SmsTransceiver = require('node-sms-transceiver');
const smstransceiver = new SmsTransceiver('/dev/ttyMODEM0');

(async () => {
  await smstransceiver.open();
  let text = 'Hello!';
  let indexes = await smstransceiver.writeSubmitMessage('09000000000', text);
  console.log(indexes);
  await smstransceiver.close();
})();
```
the code above will output the result as follows:

```
[ 0 ]
```

If the message text is long, the message text will be divided into multiple messages as a concatenated SMS message.

```javascript
const SmsTransceiver = require('node-sms-transceiver');
const smstransceiver = new SmsTransceiver('/dev/ttyMODEM0');

(async () => {
  await smstransceiver.open();
  let text = 'SMS (short message service) is a text messaging service component of most telephone, Internet, and mobile device systems. It uses standardized communication protocols to enable mobile devices to exchange short text messages. An intermediary service can facilitate a text-to-voice conversion to be sent to landlines.'
  let indexes = await smstransceiver.writeSubmitMessage('09000000000', text);
  console.log(indexes);
  await smstransceiver.close();
})();
```

the code above will output the result as follows:

```
[ 1, 2, 3 ]
```

Note that you can access the concatenated SMS message only with the index number `1`. If you pass `2` or `3` to the [`readMessage()`](#SmsTransceiver-readMessage-method), [`deleteMessage()`](#SmsTransceiver-deleteMessage-method), or [`sendStoredMessage()`](#SmsTransceiver-sendStoredMessage-method) method, the message won't be found.

### <a id="SmsTransceiver-sendStoredMessage-method">`sendStoredMessage()` method</a>

The `sendStoredMessage()` method sends a message stored in the preferred message storage. This method returns a `Promise` object. Nothing will be passed to the `resolve()`.

```javascript
const SmsTransceiver = require('node-sms-transceiver');
const smstransceiver = new SmsTransceiver('/dev/ttyMODEM0');

(async () => {
  await smstransceiver.open();
  await smstransceiver.sendStoredMessage(1);
  await smstransceiver.close();
})();
```

Note that some LTE modules do not seem to support concatenated SMS. With such LTE module, it could freeze. If your LTE module do not support concatenated SMS, do not send a long text message.

---------------------------------------
## <a id="SmsMessage-object">`SmsMessage` object</a>

The `SmsMessage` object represents a SMS message. This object consists of the properties described in the table below:

Property  | Type   | Description
:---------|:-------|:--------------------------
`index`   | Integer | Index number
`stat`    | Integer | Message status
`type`    | String  | PDU type (`"SMS-DELIVER"` or `"SMS-SUBMIT"`)
`from`    | String  | Phone number of the origination. When the `type` is `"SMS-SUBMIT"`, this value is `null`.
`to`      | String  | Phone number of destination. When the `type` is `"SMS-DELIVER"`, this value is `null`.
`date`    | String  | Time stamp when the message was sent. When the `type` is `"SMS-SUBMIT"`, this value is `null`.
`concat`  | Object  | Concatenated SMS information. If the message is not a concatenated SMS message, this value is `null`.
&nbsp;&nbsp;&nbsp;&nbsp;`reference` | Integer | Reference number
&nbsp;&nbsp;&nbsp;&nbsp;`total`     | Integer | Number of messages
&nbsp;&nbsp;&nbsp;&nbsp;`indexes`   | Array   | List of index numbers
`text`    | String  | SMS message text

The `type` is either `"SMS-DELIVER"` or `"SMS-SUBMIT"`. `"SMS-DELIVER"` means a received message, `"SMS-SUBMIT"` means a transmitted message.

The `stat` is an integer in the range of `0` to `4`. The meaning of each value is as follows:

- 0: new message (`"SMS-DELIVER"`)
- 1: read message (`"SMS-DELIVER"`)
- 2: stored message not yet sent (`"SMS-SUBMIT"`)
- 3: stored message already sent (`"SMS-SUBMIT"`)
- 4: all messages

Example of SMS-DELIVER (Concatenated SMS message)
```
{
  "index": 0,
  "stat": 0,
  "type": "SMS-DELIVER",
  "from": "09000000000",
  "to": null,
  "date": "2020-04-11T17:20:46+09:00",
  "concat": {
    "reference": 17,
    "total": 3,
    "indexes": [
      0,
      1,
      2
    ]
  },
  "text": "SMS (short message service) is a text messaging ..."
}
```

Example of SMS-SUBMIT
```
{
  "index": 3,
  "stat": 2,
  "type": "SMS-SUBMIT",
  "from": null,
  "to": "09000000000",
  "date": null,
  "concat": null,
  "text": "Hello!"
}
```

---------------------------------------
## <a id="Release-Note">Release Note</a>

* v0.0.1 (2020-04-11)
  * First public release

---------------------------------------
## <a id="References">References</a>

* [OpenCelliD](http://www.opencellid.org/)

---------------------------------------
## <a id="License">License</a>

The MIT License (MIT)

Copyright (c) 2020 Futomi Hatano

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
