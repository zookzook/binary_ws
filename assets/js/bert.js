/**
 * UTF-8 Support comes from https://github.com/synrc/n2o/blob/master/priv/utf8.js
 */
function utf8_dec(buffer) { return (new TextDecoder()).decode(buffer); }
function utf8_enc(buffer) { return (new TextEncoder("utf-8")).encode(buffer); }
function utf8_arr(buffer) {

    if(!(buffer instanceof ArrayBuffer))
        buffer = new Uint8Array(utf8_enc(buffer)).buffer;

    return utf8_dec(buffer);
}

/**
 * Comes from https://github.com/synrc/n2o/blob/master/priv/ieee754.js
 */
function read_Float(buffer, offset, isLE, mLen, nBytes) {
    let e, m;
    let eLen = (nBytes * 8) - mLen - 1;
    let eMax = (1 << eLen) - 1;
    let eBias = eMax >> 1;
    let nBits = -7;
    let i = isLE ? (nBytes - 1) : 0;
    let d = isLE ? -1 : 1;
    let s = buffer[offset + i];
    i += d;
    e = s & ((1 << (-nBits)) - 1);
    s >>= (-nBits);
    nBits += eLen;
    for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}
    m = e & ((1 << (-nBits)) - 1);
    e >>= (-nBits);
    nBits += mLen;
    for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}
    if (e === 0) {
        e = 1 - eBias
    } else if (e === eMax) {
        return m ? NaN : ((s ? -1 : 1) * Infinity)
    } else {
        m = m + Math.pow(2, mLen)
        e = e - eBias
    }
    return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

function write_float(buffer, value, offset, isLE, mLen, nBytes) {
    let e, m, c
    let eLen = (nBytes * 8) - mLen - 1
    let eMax = (1 << eLen) - 1
    let eBias = eMax >> 1
    let rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
    let i = isLE ? 0 : (nBytes - 1)
    let d = isLE ? 1 : -1
    let s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0
    value = Math.abs(value)
    if (isNaN(value) || value === Infinity) {
        m = isNaN(value) ? 1 : 0
        e = eMax
    } else {
        e = Math.floor(Math.log(value) / Math.LN2)
        if (value * (c = Math.pow(2, -e)) < 1) {
            e--
            c *= 2
        }
        if (e + eBias >= 1) {
            value += rt / c
        } else {
            value += rt * Math.pow(2, 1 - eBias)
        }
        if (value * c >= 2) {
            e++
            c /= 2
        }
        if (e + eBias >= eMax) {
            m = 0
            e = eMax
        } else if (e + eBias >= 1) {
            m = ((value * c) - 1) * Math.pow(2, mLen)
            e = e + eBias
        } else {
            m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
            e = 0
        }
    }
    for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}
    e = (e << mLen) | m
    eLen += mLen
    for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}
    buffer[offset + i - d] |= s * 128
}

/**
 *
 * Decoder comes from https://github.com/synrc/n2o/blob/master/priv/bert.js
 *
 * The code was refactored (renaming variables, reorganisation of code blocks, renaming function names) for better reading and maintaining.
 */
export function decode(buffer) {

    let data  = new DataView(buffer);
    let index = 0;

    function decode_big_bignum() {
        let skip = data.getInt32(index);
        index += 4;
        return decode_bignum(skip);
    }

    function decode_small_bignum() {
        let skip = data.getUint8(index);
        index += 1;
        return decode_bignum(skip);
    }

    function decode_bignum(skip) {
        let result = 0;
        let sig = data.getUint8(index++);
        let count = skip;
        while(count-- > 0) {
            result = 256 * result + data.getUint8(index + count);
        }
        index += skip;
        return result * (sig === 0 ? 1 : -1);
    }

    function decode_tiny_int() {
        let result = data.getUint8(index);
        index += 1;
        return result;
    }

    function decode_int() {
        let result = data.getInt32(index);
        index += 4;
        return result;
    }

    function decode_string_8() {
        let size = data.getUint8(index);
        index += 1;
        let result = data.buffer.slice(index, index + size);
        index += size;
        return utf8_arr(result);
    }

    function decode_string_16() {
        let size = data.getUint16(index);
        index += 2;
        let result = data.buffer.slice(index, index + size);
        index += size;
        return utf8_arr(result);
    }

    function decode_string_32() {
        let size = data.getUint32(index);
        index += 4;
        let result = data.buffer.slice(index, index + size);
        index += size;
        return utf8_arr(result);
    }

    function decode_tuple_8() {
        let size = data.getUint8(index);
        index += 1;
        return decode_tuple(size);
    }

    function decode_tuple_32() {
        let size = data.getUint32(index);
        index += 4;
        return decode_tuple(size);
    }

    function decode_tuple(size) {
        let result = [];
        for (let i = 0; i < size; i++) {
            result.push(decode_type());
        }
        return result;
    }
    function decode_list_32() {
        let size = data.getUint32(index);
        let result = [];
        index += 4;
        for (let i = 0; i < size; i++) {
            result.push(decode_type());
        }
        decode_type();
        return result;
    }

    function decode_list_8() {
        let size = data.getUint8(index);
        index += 1;
        let result = [];
        for (let i = 0; i < size; i++) {
            result.push(decode_type());
        }
        decode_type();
        return result;
    }

    function decode_map() {
        let size = data.getUint32(index);
        let result = {};
        index += 4;
        for (let i = 0; i < size; i++) {
            let key = decode_type();
            result[key] = decode_type();
        }
        return result;
    }
    function decode_iee() {
        let result = read_Float(new Uint8Array(data.buffer.slice(index, index + 8)), 0, false, 52, 8);
        index += 8;
        return result;
    }
    function decode_flo() {
        let result = parseFloat(utf8_arr(data.buffer.slice(index, index + 31)));
        index += 31;
        return result;
    }

    function decode_charlist() {
        let size = data.getUint16(index);
        index += 2;
        let result = new Uint8Array(data.buffer.slice(index, index + size));
        index += size;
        return result;
    }

    function decode_type() {
        let type = data.getUint8(index);
        index += 1;
        switch(type) {
            case  97: return decode_tiny_int();
            case  98: return decode_int();
            case  99: return decode_flo();
            case  70: return decode_iee();
            case 100: return decode_string_16();
            case 104: return decode_tuple_8();
            case 107: return decode_charlist();
            case 108: return decode_list_32();
            case 109: return decode_string_32();
            case 110: return decode_small_bignum();
            case 111: return decode_big_bignum();
            case 115: return decode_string_8();
            case 118: return decode_string_16();
            case 119: return decode_string_8();
            case 105: return decode_tuple_32();
            case 116: return decode_map();
            default:  return [];
        }
    }

    if (data.getUint8(index) !== 131)
        throw ("BERT?");

    index += 1;

    return decode_type();
}

export function encode(json) {

    function byte_length(value) {

        if(value instanceof ArrayBuffer || value instanceof Uint8Array) {
            return value.byteLength
        }
        else {
            return (new TextEncoder().encode(value)).byteLength
        }
    }

    function to_array_8(value) {

        if(value instanceof ArrayBuffer) {
            return new Uint8Array(value);
        } // if
        else if(value instanceof Uint8Array) {
            return value;
        } // if
        else if(Array.isArray(value)) {
            return new Uint8Array(value);
        } // if
        else {
            return new Uint8Array(utf8_enc(value));
        } // else
    }

    function encode_binary(string) {
        let length = byte_length(string);
        return [109, length >>> 24, (length >>> 16) & 255, (length >>> 8) & 255, length & 255, to_array_8(string)];
    }

    function encode_atom(value) {
        return [100, value.length >>> 8, value.length & 255, to_array_8(value)];
    }

    function encode_charlist(value) {

    }

    function encode_float(value) {
        let result = Array(8).fill(0).flat();
        write_float(result, value, 0, false, 52, 8);
        return [70, result]
    }

    function encode_float_posix(value) {
        let obj = value.toExponential(20);
        let match = /([^e]+)(e[+-])(\d+)/.exec(obj);
        let exponentialPart = "0";
        if( match[3].length === 1 ) {
            exponentialPart = "0" + match[3]
        }
        else {
            exponentialPart = match[3]
        } // else

        let num = Array.from(to_array_8(match[1] + match[2] + exponentialPart));
        return [99, num, Array(31 - num.length).fill(0).flat()];
    }

    function encode_boolean(value) {
        if(value) {
            return encode_atom("true");
        } // if
        else {
            return encode_atom("false");
        } // else
    }

    function encode_array(array) {
        let length = array.length;
        if(length === 0) {
            return [106];
        } // if
        else {
            let result = [];
            for (let i = 0; i < length; i++) {
                result.push(encode_object(array[i]));
            }
            return [108, length >>> 24, (length >>> 16) & 255, (length >>> 8) & 255, length & 255, result, 106];
        } // else
    }

    function encode_map(map) {
        let result = [];
        let length = 0;
        for (let key in map) {
            if (map.hasOwnProperty(key)) {
                result.push([encode_object(key), encode_object(map[key])]);
                length += 1;
            } // if
        } // for
        return [116, length >>> 24, (length >>> 16) & 255, (length >>> 8) & 255, length & 255, result]
    }

    function encode_number(number) {
        const isInteger = number % 1 === 0;
        // Float
        if (!isInteger)
            return encode_float(number);
        else {

            if (number >= 0 && number < 256) {
                return [97, number];
            } else if (number >= -134217728 && number <= 134217727) {
                return [98, number >>> 24, (number >>> 16) & 255, (number >>> 8) & 255, number & 255];
            } else {
                let bytes = bignum_to_bytes(number);
                let length = bytes.length;
                if (length < 256) {
                    return [110, size & 255, bytes];
                } else {
                    return [111, size >>> 24, (size >>> 16) & 255, (size >>> 8) & 255, size & 255, bytes];
                }
            }
        }
    }

    function bignum_to_bytes(number) {
        let result = [];
        if (number < 0) {
            number = -number;
            result.push(1);
        } else {
            result.push(0);
        } // else

        while (number !== 0) {
            let rem = number % 256;
            result.push(rem);
            number = Math.floor(number / 256);
        } // while

        return result;
    }

    function encode_object(obj) {

        if(obj instanceof ArrayBuffer) {
            return encode_binary(obj)
        }
        else if(obj instanceof Uint8Array) {
            return encode_binary(obj)
        } else if(Array.isArray(obj)) {
            return encode_array(obj);
        }
        else if( obj == null) {
            return encode_atom('nil');
        }
        else {
            switch(typeof(obj)) {
                case 'string': return encode_binary(obj);
                case 'boolean': return encode_boolean(obj);
                case 'number': return encode_number(obj);
                case 'object': return encode_map(obj);
                default: return encode_atom('nil');
            }
        }
    }

    return [131, encode_object(json)];
}

export function to_byte_array(array) {

    function flatten(arr) {
        return arr.reduce(function (flat, toFlatten) {
            if(toFlatten instanceof Uint8Array) {
                toFlatten = Array.from(toFlatten);
            } // if
            return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
        }, []);
    }

    return new Uint8Array(flatten(array)).buffer;
}