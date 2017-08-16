/*!
 * int64.js - int64 object for javascript.
 * Copyright (c) 2017, Christopher Jeffrey (MIT License).
 * https://github.com/chjj/n64
 */

/* eslint no-var: "off" */
/* eslint prefer-const: "off" */

'use strict';

/*
 * N64 (abstract)
 */

function N64() {
  this.hi = 0;
  this.lo = 0;
}

/*
 * Sign
 */

N64.prototype.signed = false;

/*
 * Addition
 */

N64.prototype._add = function _add(bhi, blo) {
  var ahi = this.hi;
  var alo = this.lo;
  var hi, lo, as, bs, s, c;

  // Credit to @indutny for this method.
  lo = (alo + blo) | 0;

  s = lo >> 31;
  as = alo >> 31;
  bs = blo >> 31;

  c = ((as & bs) | (~s & (as ^ bs))) & 1;

  hi = ((ahi + bhi) | 0) + c;

  this.hi = hi | 0;
  this.lo = lo;

  return this;
};

N64.prototype.iadd = function iadd(b) {
  enforce(N64.isN64(b), 'operand', 'int64');
  return this._add(b.hi, b.lo);
};

N64.prototype.iaddn = function iaddn(num) {
  enforce(isNumber(num), 'operand', 'number');
  return this._add((num >> 31) & -this.signed, num | 0);
};

N64.prototype.add = function add(b) {
  return this.clone().iadd(b);
};

N64.prototype.addn = function addn(num) {
  return this.clone().iaddn(num);
};

/*
 * Subtraction
 */

N64.prototype._sub = function _sub(bhi, blo) {
  bhi = ~bhi;
  blo = ~blo;

  if (blo === -1) {
    blo = 0;
    bhi += 1;
    bhi |= 0;
  } else {
    blo += 1;
  }

  return this._add(bhi, blo);
};

N64.prototype.isub = function isub(b) {
  enforce(N64.isN64(b), 'operand', 'int64');
  return this._sub(b.hi, b.lo);
};

N64.prototype.isubn = function isubn(num) {
  enforce(isNumber(num), 'operand', 'number');
  return this._sub((num >> 31) & -this.signed, num | 0);
};

N64.prototype.sub = function sub(b) {
  return this.clone().isub(b);
};

N64.prototype.subn = function subn(num) {
  return this.clone().isubn(num);
};

/*
 * Multiplication
 */

N64.prototype._mul = function _mul(bhi, blo) {
  var ahi = this.hi;
  var alo = this.lo;
  var a48, a32, a16, a00;
  var b48, b32, b16, b00;
  var c48, c32, c16, c00;
  var hi, lo;

  a48 = ahi >>> 16;
  a32 = ahi & 0xffff;
  a16 = alo >>> 16;
  a00 = alo & 0xffff;

  b48 = bhi >>> 16;
  b32 = bhi & 0xffff;
  b16 = blo >>> 16;
  b00 = blo & 0xffff;

  c48 = 0;
  c32 = 0;
  c16 = 0;
  c00 = 0;

  c00 += a00 * b00;
  c16 += c00 >>> 16;
  c00 &= 0xffff;
  c16 += a16 * b00;
  c32 += c16 >>> 16;
  c16 &= 0xffff;
  c16 += a00 * b16;
  c32 += c16 >>> 16;
  c16 &= 0xffff;
  c32 += a32 * b00;
  c48 += c32 >>> 16;
  c32 &= 0xffff;
  c32 += a16 * b16;
  c48 += c32 >>> 16;
  c32 &= 0xffff;
  c32 += a00 * b32;
  c48 += c32 >>> 16;
  c32 &= 0xffff;
  c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48;
  c48 &= 0xffff;

  hi = (c48 << 16) | c32;
  lo = (c16 << 16) | c00;

  this.hi = hi;
  this.lo = lo;

  return this;
};

N64.prototype.imul = function imul(b) {
  enforce(N64.isN64(b), 'multiplicand', 'int64');
  return this._mul(b.hi, b.lo);
};

N64.prototype.imuln = function imuln(num) {
  enforce(isNumber(num), 'multiplicand', 'number');
  return this._mul((num >> 31) & -this.signed, num | 0);
};

N64.prototype.mul = function mul(b) {
  return this.clone().imul(b);
};

N64.prototype.muln = function muln(num) {
  return this.clone().imuln(num);
};

/*
 * Division
 */

N64.prototype.idiv = function idiv(b) {
  var a = this;
  var neg = false;
  var n, d, q, r, bit;

  enforce(N64.isN64(b), 'divisor', 'int64');

  if (b.isZero())
    throw new Error('Cannot divide by zero.');

  if (a.isZero())
    return a;

  if (a.eq(b))
    return a.set(1);

  if (a.isSafe() && b.isSafe()) {
    n = a.toDouble();
    d = b.toDouble();
    q = floor(n / d);
    return a.set(q);
  }

  if (a.signed) {
    if (a.hi < 0) {
      if (b.hi < 0) {
        a = a.ineg();
        b = b.neg();
      } else {
        a = a.ineg();
        neg = true;
      }
    } else if (b.hi < 0) {
      b = b.neg();
      neg = true;
    }
  }

  n = a.toUnsigned();
  d = b.toUnsigned();

  if (n.lt(d))
    return a.set(0);

  if (n.ushrn(1).lt(d))
    return a.set(neg ? -1 : 1);

  q = this.set(0);
  bit = n.bitLength();

  r = new U64();

  while (bit--) {
    r.ishln(1);
    r.lo |= n.testn(bit);
    if (r.gte(d)) {
      r.isub(d);
      q.setn(bit, 1);
    }
  }

  if (neg)
    q.ineg();

  return q;
};

N64.prototype.idivn = function idivn(num) {
  enforce(isNumber(num), 'divisor', 'number');
  return this.idiv(this.small(num));
};

N64.prototype.div = function div(b) {
  return this.clone().idiv(b);
};

N64.prototype.divn = function divn(num) {
  return this.clone().idivn(num);
};

/*
 * Modulo
 */

N64.prototype.imod = function imod(b) {
  var a = this;
  var n, d, r;

  enforce(N64.isN64(b), 'divisor', 'int64');

  if (b.isZero())
    throw new Error('Cannot divide by zero.');

  if (a.isZero())
    return a;

  if (a.eq(b))
    return a.set(0);

  if (a.isSafe() && b.isSafe()) {
    n = a.toDouble();
    d = b.toDouble();
    r = n % d;
    return a.set(r);
  }

  return a.isub(a.div(b).imul(b));
};

N64.prototype.imodn = function imodn(num) {
  enforce(isNumber(num), 'divisor', 'number');
  return this.imod(this.small(num));
};

N64.prototype.mod = function mod(b) {
  return this.clone().imod(b);
};

N64.prototype.modn = function modn(num) {
  return this.clone().imodn(num);
};

/*
 * Exponentiation
 */

N64.prototype.ipow = function ipow(b) {
  enforce(N64.isN64(b), 'exponent', 'int64');
  return this.ipown(b.lo);
};

N64.prototype.ipown = function ipown(num) {
  var x, y, n;

  enforce(isNumber(num), 'exponent', 'number');

  if (this.isZero())
    return this;

  x = this.clone();
  y = num >>> 0;
  n = this;

  n.set(1);

  while (y > 0) {
    if (y & 1)
      n.imul(x);
    y >>>= 1;
    x.imul(x);
  }

  return n;
};

N64.prototype.pow = function pow(b) {
  return this.clone().ipow(b);
};

N64.prototype.pown = function pown(num) {
  return this.clone().ipown(num);
};

N64.prototype.sqr = function sqr() {
  return this.mul(this);
};

N64.prototype.isqr = function isqr() {
  return this.imul(this);
};

/*
 * AND
 */

N64.prototype.iand = function iand(b) {
  enforce(N64.isN64(b), 'operand', 'int64');
  this.hi &= b.hi;
  this.lo &= b.lo;
  return this;
};

N64.prototype.iandn = function iandn(num) {
  enforce(isNumber(num), 'operand', 'number');
  this.hi &= (num >> 31) & -this.signed;
  this.lo &= num | 0;
  return this;
};

N64.prototype.and = function and(b) {
  return this.clone().iand(b);
};

N64.prototype.andn = function andn(num) {
  return this.clone().iandn(num);
};

/*
 * OR
 */

N64.prototype.ior = function ior(b) {
  enforce(N64.isN64(b), 'operand', 'int64');
  this.hi |= b.hi;
  this.lo |= b.lo;
  return this;
};

N64.prototype.iorn = function iorn(num) {
  enforce(isNumber(num), 'operand', 'number');
  this.hi |= (num >> 31) & -this.signed;
  this.lo |= num | 0;
  return this;
};

N64.prototype.or = function or(b) {
  return this.clone().ior(b);
};

N64.prototype.orn = function orn(num) {
  return this.clone().iorn(num);
};

/*
 * XOR
 */

N64.prototype.ixor = function ixor(b) {
  enforce(N64.isN64(b), 'operand', 'int64');
  this.hi ^= b.hi;
  this.lo ^= b.lo;
  return this;
};

N64.prototype.ixorn = function ixorn(num) {
  enforce(isNumber(num), 'operand', 'number');
  this.hi ^= (num >> 31) & -this.signed;
  this.lo ^= num | 0;
  return this;
};

N64.prototype.xor = function xor(b) {
  return this.clone().ixor(b);
};

N64.prototype.xorn = function xorn(num) {
  return this.clone().ixorn(num);
};

/*
 * NOT
 */

N64.prototype.inot = function inot() {
  this.hi = ~this.hi;
  this.lo = ~this.lo;
  return this;
};

N64.prototype.not = function not() {
  return this.clone().inot();
};

/*
 * Left Shift
 */

N64.prototype.ishl = function ishl(b) {
  enforce(N64.isN64(b), 'bits', 'int64');
  return this.ishln(b.lo);
};

N64.prototype.ishln = function ishln(bits) {
  var hi = this.hi;
  var lo = this.lo;

  enforce(isNumber(bits), 'bits', 'number');

  bits &= 63;

  if (bits === 0)
    return this;

  if (bits < 32) {
    hi <<= bits;
    hi |= lo >>> (32 - bits);
    lo <<= bits;
  } else {
    hi = lo << (bits - 32);
    lo = 0;
  }

  this.hi = hi;
  this.lo = lo;

  return this;
};

N64.prototype.shl = function shl(b) {
  return this.clone().ishl(b);
};

N64.prototype.shln = function shln(bits) {
  return this.clone().ishln(bits);
};

/*
 * Right Shift
 */

N64.prototype.ishr = function ishr(b) {
  enforce(N64.isN64(b), 'bits', 'int64');
  return this.ishrn(b.lo);
};

N64.prototype.ishrn = function ishrn(bits) {
  var hi = this.hi;
  var lo = this.lo;

  if (!this.signed)
    return this.iushrn(bits);

  enforce(isNumber(bits), 'bits', 'number');

  bits &= 63;

  if (bits === 0)
    return this;

  if (bits < 32) {
    lo >>>= bits;
    lo |= hi << (32 - bits);
    hi >>= bits;
  } else {
    lo = hi >> (bits - 32);
    hi = hi >> 31;
  }

  this.hi = hi;
  this.lo = lo;

  return this;
};

N64.prototype.shr = function shr(b) {
  return this.clone().ishr(b);
};

N64.prototype.shrn = function shrn(bits) {
  return this.clone().ishrn(bits);
};

/*
 * Unsigned Right Shift
 */

N64.prototype.iushr = function iushr(b) {
  enforce(N64.isN64(b), 'bits', 'int64');
  return this.iushrn(b.lo);
};

N64.prototype.iushrn = function iushrn(bits) {
  var hi = this.hi;
  var lo = this.lo;

  enforce(isNumber(bits), 'bits', 'number');

  bits &= 63;

  if (bits === 0)
    return this;

  if (bits < 32) {
    lo >>>= bits;
    lo |= hi << (32 - bits);
    hi >>>= bits;
  } else {
    lo = hi >>> (bits - 32);
    hi = 0;
  }

  this.hi = hi | 0;
  this.lo = lo | 0;

  return this;
};

N64.prototype.ushr = function ushr(b) {
  return this.clone().iushr(b);
};

N64.prototype.ushrn = function ushrn(bits) {
  return this.clone().iushrn(bits);
};

/*
 * Bit Manipulation
 */

N64.prototype.setn = function setn(bit, val) {
  enforce(isNumber(bit), 'bit', 'number');

  bit &= 63;

  if (bit < 32) {
    if (val)
      this.lo |= (1 << bit);
    else
      this.lo &= ~(1 << bit);
  } else {
    if (val)
      this.hi |= (1 << (bit - 32));
    else
      this.hi &= ~(1 << (bit - 32));
  }

  return this;
};

N64.prototype.testn = function testn(bit) {
  enforce(isNumber(bit), 'bit', 'number');

  bit &= 63;

  if (bit < 32)
    return (this.lo >>> bit) & 1;

  return (this.hi >>> (bit - 32)) & 1;
};

N64.prototype.imaskn = function imaskn(bit) {
  enforce(isNumber(bit), 'bit', 'number');

  bit &= 63;

  if (bit < 32) {
    this.hi = 0;
    this.lo &= (1 << bit) - 1;
  } else {
    this.hi &= (1 << (bit - 32)) - 1;
    this.lo &= 0xffffffff;
  }

  return this;
};

N64.prototype.maskn = function maskn(bit) {
  return this.clone().imaskn(bit);
};

N64.prototype.andln = function andln(num) {
  enforce(isNumber(num), 'operand', 'number');
  return this.lo & num;
};

/*
 * Negation
 */

N64.prototype.ineg = function ineg() {
  var hi = ~this.hi;
  var lo = ~this.lo;

  if (lo === -1) {
    lo = 0;
    hi += 1;
    hi |= 0;
  } else {
    lo += 1;
  }

  this.hi = hi;
  this.lo = lo;

  return this;
};

N64.prototype.neg = function neg() {
  return this.clone().ineg();
};

N64.prototype.iabs = function iabs() {
  if (this.isNeg())
    this.ineg();
  return this;
};

N64.prototype.abs = function abs() {
  return this.clone().iabs();
};

/*
 * Comparison
 */

N64.prototype._cmp = function _cmp(bhi, blo) {
  var a = this;
  var ahi = a.hi;
  var alo = a.lo;
  var x, y;

  if (ahi === bhi && alo === blo)
    return 0;

  if (a.signed) {
    x = ahi < 0;
    y = bhi < 0;

    if (x && !y)
      return -1;

    if (!x && y)
      return 1;
  }

  if (!x) {
    ahi >>>= 0;
    bhi >>>= 0;
  }

  if (ahi < bhi)
    return -1;

  if (ahi > bhi)
    return 1;

  if ((alo >>> 0) < (blo >>> 0))
    return -1;

  return 1;
};

N64.prototype.cmp = function cmp(b) {
  enforce(N64.isN64(b), 'value', 'int64');
  return this._cmp(b.hi, b.lo);
};

N64.prototype.cmpn = function cmpn(num) {
  enforce(isNumber(num), 'value', 'number');
  return this._cmp((num >> 31) & -this.signed, num | 0);
};

N64.prototype.eq = function eq(b) {
  enforce(N64.isN64(b), 'value', 'int64');
  return this.hi === b.hi && this.lo === b.lo;
};

N64.prototype.eqn = function eqn(num) {
  enforce(isNumber(num), 'value', 'number');
  return this.hi === ((num >> 31) & -this.signed) && this.lo === (num | 0);
};

N64.prototype.gt = function gt(b) {
  return this.cmp(b) > 0;
};

N64.prototype.gtn = function gtn(num) {
  return this.cmpn(num) > 0;
};

N64.prototype.gte = function gte(b) {
  return this.cmp(b) >= 0;
};

N64.prototype.gten = function gten(num) {
  return this.cmpn(num) >= 0;
};

N64.prototype.lt = function lt(b) {
  return this.cmp(b) < 0;
};

N64.prototype.ltn = function ltn(num) {
  return this.cmpn(num) < 0;
};

N64.prototype.lte = function lte(b) {
  return this.cmp(b) <= 0;
};

N64.prototype.lten = function lten(num) {
  return this.cmpn(num) <= 0;
};

N64.prototype.isZero = function isZero() {
  return this.hi === 0 && this.lo === 0;
};

N64.prototype.isNeg = function isNeg() {
  return this.signed && this.hi < 0;
};

N64.prototype.isOdd = function isOdd() {
  return (this.lo & 1) === 1;
};

N64.prototype.isEven = function isEven() {
  return (this.lo & 1) === 0;
};

/*
 * Helpers
 */

N64.prototype.clone = function clone() {
  var n = new this.constructor();
  n.hi = this.hi;
  n.lo = this.lo;
  return n;
};

N64.prototype.inject = function inject(b) {
  enforce(N64.isN64(b), 'value', 'int64');
  this.hi = b.hi;
  this.lo = b.lo;
  return this;
};

N64.prototype.set = function set(num) {
  var neg = false;

  enforce(isSafeInteger(num), 'number', 'integer');

  if (num < 0) {
    num = -num;
    neg = true;
  }

  this.hi = (num * (1 / 0x100000000)) | 0;
  this.lo = num | 0;

  if (neg)
    this.ineg();

  return this;
};

N64.prototype.join = function join(hi, lo) {
  enforce(isNumber(hi), 'hi', 'number');
  enforce(isNumber(lo), 'lo', 'number');
  this.hi = hi | 0;
  this.lo = lo | 0;
  return this;
};

N64.prototype.small = function small(num) {
  var n = new this.constructor();
  n.hi = (num >> 31) & -this.signed;
  n.lo = num | 0;
  return n;
};

N64.prototype.toSigned = function toSigned() {
  var b = new I64();
  b.hi = this.hi;
  b.lo = this.lo;
  return b;
};

N64.prototype.toUnsigned = function toUnsigned() {
  var b = new U64();
  b.hi = this.hi;
  b.lo = this.lo;
  return b;
};

N64.prototype.bitLength = function bitLength() {
  var a = this;

  if (this.isNeg())
    a = this.neg();

  if (a.hi === 0)
    return countBits(a.lo);

  return countBits(a.hi) + 32;
};

N64.prototype.byteLength = function byteLength() {
  return Math.ceil(this.bitLength() / 8);
};

N64.prototype.isSafe = function isSafe() {
  var hi = this.hi;

  if (this.isNeg()) {
    hi = ~hi;
    if (this.lo === 0)
      hi += 1;
  }

  return (hi & 0xffe00000) === 0;
};

N64.prototype.inspect = function inspect() {
  var prefix = 'I64';

  if (!this.signed)
    prefix = 'U64';

  return '<' + prefix + ': ' + this.toString(10) + '>';
};

/*
 * Encoding
 */

N64.prototype.readLE = function readLE(data, off) {
  enforce(data && typeof data.length === 'number', 'data', 'arraylike');
  enforce((off >> 0) === off, 'offset', 'integer');
  this.lo = readInt32LE(data, off);
  this.hi = readInt32LE(data, off + 4);
  return off + 8;
};

N64.prototype.readBE = function readBE(data, off) {
  enforce(data && typeof data.length === 'number', 'data', 'arraylike');
  enforce((off >> 0) === off, 'offset', 'integer');
  this.hi = readInt32BE(data, off);
  this.lo = readInt32BE(data, off + 4);
  return off + 8;
};

N64.prototype.readRaw = function readRaw(data, off) {
  return this.readLE(data, off);
};

N64.prototype.writeLE = function writeLE(data, off) {
  enforce(data && typeof data.length === 'number', 'data', 'arraylike');
  enforce((off >> 0) === off, 'offset', 'integer');
  writeInt32LE(data, this.lo, off);
  writeInt32LE(data, this.hi, off + 4);
  return off + 8;
};

N64.prototype.writeBE = function writeBE(data, off) {
  enforce(data && typeof data.length === 'number', 'data', 'arraylike');
  enforce((off >> 0) === off, 'offset', 'integer');
  writeInt32BE(data, this.hi, off);
  writeInt32BE(data, this.lo, off + 4);
  return off + 8;
};

N64.prototype.writeRaw = function writeRaw(data, off) {
  return this.writeLE(data, off);
};

/*
 * Conversion
 */

N64.prototype.toNumber = function toNumber() {
  if (!this.isSafe())
    throw new Error('Number exceeds 53 bits.');

  return this.toDouble();
};

N64.prototype.toDouble = function toDouble() {
  var hi = this.hi;

  if (!this.signed)
    hi >>>= 0;

  return hi * 0x100000000 + (this.lo >>> 0);
};

N64.prototype.toInt = function toInt() {
  return this.signed ? this.lo : this.lo >>> 0;
};

N64.prototype.toBits = function toBits() {
  return [this.hi, this.lo];
};

N64.prototype.toObject = function toObject() {
  return { hi: this.hi, lo: this.lo };
};

N64.prototype.toString = function toString(base) {
  var n = this;
  var str = '';
  var neg = false;
  var ch, hi, lo;

  if (base == null)
    base = 10;

  enforce((base | 0) === base, 'base', 'integer');

  if (base < 2 || base > 16)
    throw new Error('Base ranges between 2 and 16.');

  if (n.isZero())
    return '0';

  if (n.isNeg()) {
    n = n.neg();
    neg = true;
  }

  hi = n.hi >>> 0;
  lo = n.lo >>> 0;

  do {
    ch = hi % base;
    hi -= ch;
    hi /= base;
    lo += ch * 0x100000000;

    ch = lo % base;
    lo -= ch;
    lo /= base;

    if (ch < 10)
      ch += 0x30;
    else
      ch += 0x61 - 10;

    ch = String.fromCharCode(ch);
    str = ch + str;
  } while (lo > 0 || hi > 0);

  if (neg)
    str = '-' + str;

  return str;
};

N64.prototype.toJSON = function toJSON() {
  return this.toString(16);
};

N64.prototype.toBN = function toBN(BN) {
  var neg = this.isNeg();
  var hi = this.hi;
  var lo = this.lo;
  var b;

  if (neg) {
    hi = ~hi;
    if (lo === 0) {
      hi += 1;
      hi |= 0;
    } else {
      lo = ~lo + 1;
    }
  }

  hi = new BN(hi >>> 0);
  lo = new BN(lo >>> 0);

  b = hi;
  b.ishln(32);
  b.iadd(lo);

  if (neg)
    b.ineg();

  return b;
};

N64.prototype.toLE = function toLE(ArrayLike) {
  var data = alloc(ArrayLike, 8);
  this.writeLE(data, 0);
  return data;
};

N64.prototype.toBE = function toBE(ArrayLike) {
  var data = alloc(ArrayLike, 8);
  this.writeBE(data, 0);
  return data;
};

N64.prototype.toRaw = function toRaw(ArrayLike) {
  return this.toLE(ArrayLike);
};

/*
 * Instantiation
 */

N64.prototype.fromNumber = function fromNumber(num) {
  return this.set(num);
};

N64.prototype.fromInt = function fromInt(num) {
  enforce(isNumber(num), 'integer', 'number');
  return this.join((num >> 31) & -this.signed, num);
};

N64.prototype.fromBits = function fromBits(hi, lo) {
  return this.join(hi, lo);
};

N64.prototype.fromObject = function fromObject(num) {
  enforce(num && typeof num === 'object', 'number', 'object');
  return this.fromBits(num.hi, num.lo);
};

N64.prototype.fromString = function fromString(str, base) {
  var neg = false;
  var hi = 0;
  var lo = 0;
  var i = 0;
  var ch;

  if (base == null)
    base = 10;

  enforce(typeof str === 'string', 'string', 'string');
  enforce((base | 0) === base, 'base', 'integer');

  if (base < 2 || base > 16)
    throw new Error('Base ranges between 2 and 16.');

  if (str.length > 0 && str[0] === '-') {
    i += 1;
    neg = true;
  }

  if (str.length === i || str.length > i + 64)
    throw new Error('Invalid string (bad length).');

  for (; i < str.length; i++) {
    ch = str.charCodeAt(i);

    if (ch >= 0x30 && ch <= 0x39)
      ch -= 0x30;
    else if (ch >= 0x41 && ch <= 0x5a)
      ch -= 0x41 - 10;
    else if (ch >= 0x61 && ch <= 0x7a)
      ch -= 0x61 - 10;
    else
      ch = base;

    if (ch >= base)
      throw new Error('Invalid string (parse error).');

    lo *= base;
    lo += ch;

    hi *= base;

    if (lo > 0xffffffff) {
      ch = lo % 0x100000000;
      hi += (lo - ch) / 0x100000000;
      lo = ch;
    }

    if (hi > 0xffffffff)
      throw new Error('Invalid string (overflow).');
  }

  this.hi = hi | 0;
  this.lo = lo | 0;

  if (neg)
    this.ineg();

  return this;
};

N64.prototype.fromJSON = function fromJSON(json) {
  return this.fromString(json, 16);
};

N64.prototype.fromBN = function fromBN(num) {
  var a = this;
  var b = num.clone();
  var neg = b.isNeg();
  var i = 0;
  var ch;

  enforce(num && isArray(num.words), 'number', 'big number');

  if (a.signed && b.testn(63))
    throw new Error('Big number overflow.');

  while (!b.isZero()) {
    if (i === 8)
      throw new Error('Big number overflow.');

    ch = b.andln(0xff);

    if (i < 4)
      a.lo |= ch << (i * 8);
    else
      a.hi |= ch << ((i - 4) * 8);

    b.iushrn(8);
    i++;
  }

  if (neg)
    a.ineg();

  return a;
};

N64.prototype.fromLE = function fromLE(data) {
  this.readLE(data, 0);
  return this;
};

N64.prototype.fromBE = function fromBE(data) {
  this.readBE(data, 0);
  return this;
};

N64.prototype.fromRaw = function fromRaw(data) {
  return this.fromLE(data);
};

N64.prototype.from = function from(num, base) {
  if (num == null)
    return this;

  if (typeof num === 'number') {
    if (typeof base === 'number')
      return this.fromBits(num, base);
    return this.fromNumber(num);
  }

  if (typeof num === 'string')
    return this.fromString(num, base);

  if (typeof num === 'object') {
    if (isArray(num.words))
      return this.fromBN(num);

    if (typeof num.length === 'number')
      return this.fromRaw(num);

    return this.fromObject(num);
  }

  throw new TypeError('Non-numeric object passed to N64.');
};

/*
 * Static Methods
 */

N64.readLE = function readLE(data, off) {
  var num = new this();
  num.readLE(data, off);
  return num;
};

N64.readBE = function readBE(data, off) {
  var num = new this();
  num.readBE(data, off);
  return num;
};

N64.readRaw = function readRaw(data, off) {
  var num = new this();
  num.readRaw(data, off);
  return num;
};

N64.fromNumber = function fromNumber(num) {
  return new this().fromNumber(num);
};

N64.fromInt = function fromInt(num) {
  return new this().fromInt(num);
};

N64.fromBits = function fromBits(hi, lo) {
  return new this().fromBits(hi, lo);
};

N64.fromObject = function fromObject(obj) {
  return new this().fromObject(obj);
};

N64.fromString = function fromString(str, base) {
  return new this().fromString(str, base);
};

N64.fromJSON = function fromJSON(json) {
  return new this().fromJSON(json);
};

N64.fromBN = function fromBN(num) {
  return new this().fromBN(num);
};

N64.fromLE = function fromLE(data) {
  return new this().fromLE(data);
};

N64.fromBE = function fromBE(data) {
  return new this().fromBE(data);
};

N64.fromRaw = function fromRaw(data) {
  return new this().fromRaw(data);
};

N64.from = function from(num, base) {
  return new this().from(num, base);
};

N64.random = function random() {
  var num = new this();
  num.hi = (Math.random() * 0x100000000) | 0;
  num.lo = (Math.random() * 0x100000000) | 0;
  return num;
};

N64.pow = function pow(num, exp) {
  return new this().fromInt(num).ipown(exp);
};

N64.shift = function shift(num, bits) {
  return new this().fromInt(num).ishln(bits);
};

N64.isN64 = function isN64(obj) {
  return obj instanceof N64;
};

/*
 * U64
 */

function U64(num, base) {
  if (!(this instanceof U64))
    return new U64(num, base);

  N64.call(this);

  this.from(num, base);
}

U64.__proto__ = N64;
U64.prototype.__proto__ = N64.prototype;

/*
 * Sign
 */

U64.prototype.signed = false;

/*
 * Static Methods
 */

U64.isN64 = function isN64(obj) {
  return N64.isN64(obj);
};

U64.isU64 = function isU64(obj) {
  return obj instanceof U64;
};

U64.isI64 = function isI64(obj) {
  return I64.isI64(obj);
};

/*
 * I64
 */

function I64(num, base) {
  if (!(this instanceof I64))
    return new I64(num, base);

  N64.call(this);

  this.from(num, base);
}

I64.__proto__ = N64;
I64.prototype.__proto__ = N64.prototype;

/*
 * Sign
 */

I64.prototype.signed = true;

/*
 * Static Methods
 */

I64.isN64 = function isN64(obj) {
  return N64.isN64(obj);
};

I64.isU64 = function isU64(obj) {
  return U64.isU64(obj);
};

I64.isI64 = function isI64(obj) {
  return obj instanceof I64;
};

/*
 * Module Functions
 */

exports.min = function min(a, b) {
  return a.cmp(b) < 0 ? a : b;
};

exports.max = function max(a, b) {
  return a.cmp(b) > 0 ? a : b;
};

exports.isN64 = function isN64(obj) {
  return N64.isN64(obj);
};

exports.isU64 = function isU64(obj) {
  return U64.isU64(obj);
};

exports.isI64 = function isI64(obj) {
  return I64.isI64(obj);
};

/*
 * Module Constants
 */

exports.ULONG_MIN = 0x00000000;
exports.ULONG_MAX = 0xffffffff;

exports.LONG_MIN = -0x80000000;
exports.LONG_MAX = 0x7fffffff;

exports.DOUBLE_MIN = -0x001fffffffffffff;
exports.DOUBLE_MAX = 0x001fffffffffffff;

exports.UINT32_MIN = U64(0x00000000, 0x00000000);
exports.UINT32_MAX = U64(0x00000000, 0xffffffff);

exports.INT32_MIN = I64(0xffffffff, 0x80000000);
exports.INT32_MAX = I64(0x00000000, 0x7fffffff);

exports.UINT64_MIN = U64(0x00000000, 0x00000000);
exports.UINT64_MAX = U64(0xffffffff, 0xffffffff);

exports.INT64_MIN = I64(0x80000000, 0x00000000);
exports.INT64_MAX = I64(0x7fffffff, 0xffffffff);

/*
 * Helpers
 */

function countBits(word) {
  var bit;

  if (Math.clz32)
    return 32 - Math.clz32(word);

  for (bit = 31; bit >= 0; bit--) {
    if ((word & (1 << bit)) !== 0)
      break;
  }

  return bit + 1;
}

function floor(n) {
  if (n < 0)
    return -Math.floor(-n);
  return Math.floor(n);
}

function enforce(value, name, type) {
  if (!value)
    throw new TypeError('`' + name + '` must be a(n) ' + type + '.');
}

function isNumber(num) {
  return typeof num === 'number' && isFinite(num);
}

function isArray(num) {
  if (Array.isArray)
    return Array.isArray(num);

  return ({}).toString.call(num).slice(8, -1) === 'Array';
}

function isSafeInteger(num) {
  if (Number.isSafeInteger)
    return Number.isSafeInteger(num);

  return isNumber(num)
    && num % 1 === 0
    && num >= -0x001fffffffffffff
    && num <= 0x001fffffffffffff;
}

function alloc(ArrayLike, size) {
  enforce(typeof ArrayLike === 'function', 'ArrayLike', 'constructor');

  if (ArrayLike.allocUnsafe)
    return ArrayLike.allocUnsafe(size);

  return new ArrayLike(size);
}

function readInt32LE(data, off) {
  return data[off]
    | (data[off + 1] << 8)
    | (data[off + 2] << 16)
    | (data[off + 3] << 24);
}

function readInt32BE(data, off) {
  return (data[off] << 24)
    | (data[off + 1] << 16)
    | (data[off + 2] << 8)
    | data[off + 3];
}

function writeInt32LE(data, num, off) {
  data[off] = num & 0xff;
  data[off + 1] = (num >>> 8) & 0xff;
  data[off + 2] = (num >>> 16) & 0xff;
  data[off + 3] = (num >>> 24) & 0xff;
}

function writeInt32BE(data, num, off) {
  data[off] = (num >>> 24) & 0xff;
  data[off + 1] = (num >>> 16) & 0xff;
  data[off + 2] = (num >>> 8) & 0xff;
  data[off + 3] = num & 0xff;
}

/*
 * Expose
 */

exports.N64 = N64;
exports.U64 = U64;
exports.I64 = I64;