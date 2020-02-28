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
