// @flow -*- indent-tabs-mode: nil; tab-width: 2; js2-basic-offset: 2; coding: utf-8; compile-command: "cd .. && make -j" -*-
/* global $, Quill, history, console, repl, external, EditorUiSdk, EditorTextSdk */

"use strict";

/* :: type reps = Array<string> */
/* :: type err = {str: string, beg: number, end: number, len: number, typ: string, rep: Array<string>, msg: string} */
/* :: type errlist = Array<[string, number, number, string, string, Array<string>]> */
/* :: type result = { text: string, errs: errlist } */
/* :: type cb = (text: string, X:result, off: number) => void */
/* :: type authcb = (text: string) => void */
/* :: type userpass = {u: string, p: string} */
/* :: type mode = { src: string, trglang: string, trgsuff: string } */


var debug = window.location.protocol === "file:";
var log = debug ? console.log.bind(window.console) : function(_ignore) {};

var l10n = function()/*:DocumentLocalization*/ {
if(document.l10n === undefined) {
console.warn("l20n.js failed?");
return {
    // Return key unchanged for now if we have no l20n:
    formatValue: function(v) { return new Promise(function(resolve,_){resolve(v);}); },
    requestLanguages: function(_ignore/*:[string]*/){ }
};
}
// $FlowFixMe
return document.l10n;
};

var initL10n = function(lang/*:string*/, dir/*:string*/)/*:void*/ {
l10n().requestLanguages([lang]);
l10n().formatValue('editor_placeholder')
.then(function(t) {
    $('.ql-editor').attr('data-placeholder', t);
});
var el = $('<link/>');
el.attr('rel', 'stylesheet');
el.attr('href', dir + 'locales/' + lang + '.css');
$('head').append(el);
};



let Delta = Quill.import('delta');

// Define our error underlines as a kind of inline formatting in Quill:
let Inline = Quill.import('blots/inline');
class ErrorBlot extends Inline {
  static create(err/*:err*/) {
    let node = super.create();
    if(typeof(err) != "object") {
      console.log("Error creating ErrorBlot, expected object, not "+typeof(err));
      return super.create();
    }
    $(node).data("error", err);
    // TODO: Set css properties directly here instead of having one class per colour?
    var colour = "blue";
    $(node).addClass("divvun-error-"+colour);
    return node;
  }
  static formats(node) {
    return $(node).data("error");
  }

  /**
   * Changes DOM
   */
  showrep(beg/*:number*/,
          len/*:number*/,
          editor/*:DivvunEditor*/
         )/*:void*/
  {
    var spanoff = $(this.domNode).offset(),
        newoff = { top:  spanoff.top+20,
                   left: spanoff.left },
        repmenu = $('#divvun-repmenu'),
        at_same_err = repmenu.offset().top == newoff.top && repmenu.offset().left == newoff.left;
    if(repmenu.is(":visible") && at_same_err) {
      ErrorBlot.hiderep();
    }
    else {
      repmenu.show();
      repmenu.offset(newoff);
      if(!at_same_err) {
        this.makerepmenu(beg, len, editor);
      }
    }
  };

  /**
   * Changes DOM
   */
  static hiderep()/*:void*/ {
    var repmenu = $('#divvun-repmenu');
    repmenu.offset({top:0, left:0}); // avoid some potential bugs with misplacement
    repmenu.hide();
  };

  /**
   * Changes DOM
   * Populates menu.
   * TODO: ignore-button
   */
  makerepmenu(beg/*:number*/,
              len/*:number*/,
              editor/*:DivvunEditor*/
             ) {
    var span = this.domNode,
        err/*:err*/ = $(span).data("error");
    // We're looking at a new error, populate the table anew:
    $("#divvun-repmenu_tbl").empty();
    var tbody = $(document.createElement('tbody'));
    tbody.attr("role", "listbox");

    // typ is internal note?
    // var tr_typ =  $(document.createElement('tr')),
    // td_typ =  $(document.createElement('td')),
    // a_typ =  $(document.createElement('span'));
    // a_typ.text(err.typ);
    // a_typ.attr("aria-disabled", "true");
    // td_typ.append(a_typ);
    // td_typ.addClass("repmenu_typ");
    // tr_typ.append(td_typ);
    // tbody.append(tr_typ);

    if(err.msg == "") {
      err.msg = "Ukjend feiltype";
    }
    var tr_msg =  $(document.createElement('tr')),
    td_msg =  $(document.createElement('td')),
    a_msg =  $(document.createElement('span'));
    a_msg.html(err.msg);
    a_msg.attr("aria-disabled", "true");
    td_msg.append(a_msg);
    td_msg.addClass("divvun-repmenu_msg");
    tr_msg.append(td_msg);
    tbody.append(tr_msg);

    err.rep.map(function(r){
      var tr_rep =  $(document.createElement('tr')),
          td_rep =  $(document.createElement('td')),
          a_rep =  $(document.createElement('a'));
      if(r == "") {
        a_rep.text("(fjern)");
      }
      else {
        a_rep.text(r.replace(/ /g, " ")); // ensure they're not trimmed away, e.g. at ends
      }
      if(r.lastIndexOf(" ", 0)==0 || r.indexOf(" ",r.length-1)==r.length-1) {
        // start/end is a space, ensure it's visible:
        a_rep.addClass("divvun-hl-space");
      }
      a_rep.attr("role", "option");
      td_rep.append(a_rep);
      td_rep.addClass("divvun-repmenu_rep");
      td_rep.addClass("divvun-repmenu_nonfirst");
      // has to be on td since <a> doesn't fill the whole td
      td_rep.click({ beg: beg,
                     len: len,
                     r: r
                   },
                   editor.replaceErr.bind(editor));
      tr_rep.append(td_rep);
      tbody.append(tr_rep);
    });

    if(false) { // ignores TODO
      var tr_ign =  $(document.createElement('tr')),
          td_ign =  $(document.createElement('td')),
          a_ign =  $(document.createElement('a'));
      l10n().formatValue('hide_errtype').then(function(t){ a_ign.text(t); });
      a_ign.attr("role", "option");
      td_ign.append(a_ign);
      td_ign.addClass("divvun-repmenu_ign");
      td_ign.addClass("divvun-repmenu_nonfirst");
      tr_ign.append(td_ign);
      tbody.append(tr_ign);
      a_ign.click({ err: err },
                  function(e) {
                    var err = e.data.err;
                    var igntyps = safeGetItem("igntyps", new Set());
                    igntyps.add(err.typ);
                    safeSetItem("igntyps", igntyps);
                    editor.updateIgnored();
                    editor.check();
                  });
    }

    $("#divvun-repmenu_tbl").append(tbody);
  };

}                               // class ErrorBlot
ErrorBlot.blotName = 'error';
ErrorBlot.tagName = 'span';
ErrorBlot.className = 'divvun-error';
Quill.register(ErrorBlot);



/**
 * Return max index i of str such that str.substr(0, i) is smaller
 * than max_B bytes when encoded in UTF-8
 */
var u8maxlen = function(str/*:string*/, max_B/*:number*/)/*:number*/ {
  let len = str.length;
  let blen = 0;
  var best = 0;
  for (let i = 0; i < len; i++) {
    let code = str.charCodeAt(i);
    if (code > 0x7F && code <= 0x7FF) {
      blen += 2;                // e.g. å
    }
    else if (code >= 0xD800 && code <= 0xDBFF) {
      i++;       // first part of surrogate pair, e.g. 𝌆, so skip other half
      blen += 4; // the whole thing is 4 UTF-8 bytes
    }
    else if (code > 0x7FF && code <= 0xFFFF) {
      blen += 3;                // e.g. ☃
    }
    else {
      blen += 1;                // e.g. a
    }
    if(blen <= max_B) {
      best = i+1;
    }
    else {
      break;
    }
  }
  return best;
};

var test_u8maxlen = function() {
  assert(0 === u8maxlen(""    , 0), "0");
  assert(0 === u8maxlen("a"   , 0), "a0");
  assert(0 === u8maxlen("æ"   , 0), "æ0");
  assert(0 === u8maxlen("æøå" , 0), "æøå0");
  assert(0 === u8maxlen("aæøå", 0), "aæøå0");
  assert(0 === u8maxlen(""    , 1), "1");
  assert(1 === u8maxlen("a"   , 1), "a1");
  assert(0 === u8maxlen("æ"   , 1), "æ1");
  assert(0 === u8maxlen("æøå" , 1), "æøå1");
  assert(1 === u8maxlen("aæøå", 1), "aæøå1");
  assert(0 === u8maxlen(""    , 2), "2");
  assert(1 === u8maxlen("a"   , 2), "a2");
  assert(1 === u8maxlen("æ"   , 2), "æ2");
  assert(1 === u8maxlen("æøå" , 2), "æøå2");
  assert(1 === u8maxlen("aæøå", 2), "aæøå2");
  assert(2 === u8maxlen("aaøå", 2), "aaæøå2");
  assert(0 === u8maxlen(""    , 3), "3");
  assert(1 === u8maxlen("a"   , 3), "a3");
  assert(1 === u8maxlen("æ"   , 3), "æ3");
  assert(1 === u8maxlen("æøå" , 3), "æøå3");
  assert(2 === u8maxlen("aæøå", 3), "aæøå3");
  assert(2 === u8maxlen("aaøå", 3), "aaæøå3");
  assert(0 === u8maxlen("𝌆"   , 0), "𝌆0");
  assert(0 === u8maxlen("𝌆"   , 1), "𝌆1");
  assert(0 === u8maxlen("𝌆"   , 2), "𝌆2");
  assert(0 === u8maxlen("𝌆"   , 3), "𝌆3");
  assert(2 === u8maxlen("𝌆"   , 4), "𝌆4");
  assert(2 === u8maxlen("𝌆"   , 5), "𝌆5");
  return "all good";
};

var assert = function(condition, message) {
  if (!condition) {
    message = message || "Assertion failed";
    throw new Error(message);
  }
};

let APYMAXBYTES = 512; // TODO: APY endpoint to return select.PIPE_BUF ?

var lastSentenceEnd = function(str) {
  let sep = /[.:!]\s/g;
  let found = 0;
  for(let res = sep.exec(str);
      res !== null;
      res = sep.exec(str)) {
    found = res.index + res.length;
  }
  return found;
};

/* Find a length `i` s.t. `str.substr(0, i)` takes less than `max`
 * bytes when encoded in UTF-8, but more than `max*.8`, and preferably
 * ends with ". "
 */
var textCutOff = function(str/*:string*/, max_B/*:number*/)/*:number*/ {
  let len = str.length;
  let maxu8 = u8maxlen(str, max_B);
  // if it's shorter anyway, this is trivial:
  if(len <= maxu8) {
    return len;
  }
  // we'd like to find a cut-off point that looks like a sentence boundary
  // but not if that means cutting off too far back, so start
  // searching near the end:
  let minu8 = Math.floor(0.7 * maxu8);
  let sub = str.substring(minu8, maxu8);
  let found = lastSentenceEnd(sub);
  console.log(minu8, maxu8, found+minu8+1);
  return minu8 + found + 1;     // +1 because we want length, not index
};




/* WoodWing grabs keypresses in the writr and inserts them into
 * CKEDITOR. We need to override that while our editor is active.
 */
function keepKeypresses(elt/*:HTMLElement*/) {
  let keypress/*:string*/ = 'keypress'; // type annotated for flow
  elt.addEventListener(keypress,
                       function(event){
                         console.log("d: keypress",event);
                         event.stopPropagation();
                       },
                       {
                         capture: true,
                         once: false,
                         passive: true
                       });
}

var DivvunEditor = function(editorWrapper/*:HTMLElement*/, mode/*:string*/, wwTexts/*:Array<string>*/)/*:void*/ {
  let self = this;
  this.editorWrapper = editorWrapper;
  keepKeypresses(editorWrapper);
  let repmenu = $('<div id="divvun-repmenu" style="display:none" role="listbox"><div style="left: 0px;" id="divvun-repmenu_co" role="presentation"><table id="divvun-repmenu_tbl" role="presentation" cellspacing="0" border="0" cellpadding="0"></table></div></div>');
  let editorDiv = $('<div spellcheck="false">');
  $(editorWrapper)
    .append(editorDiv)
    .append(repmenu);
  let toolbarOptions = [
    ['check', 'exitandapply', 'cancel'],
  ];
  this.quill = new Quill(editorDiv.get()[0], {
    modules: {
      toolbar: {
        container: toolbarOptions,
        handlers: {
          check: function(_val) { self.check(); },
          exitandapply: function(_val) { self.exitAndApply(); },
          cancel: function(_val) { self.cancel(); }
        }
      }
    },
    theme: 'snow',
    placeholder: '(no text)'
    // https://github.com/quilljs/quill/issues/1928
    // , readOnly: true
  });

  this.DEFAULT_LANG = "sme";
  this.DEFAULT_VARIANT= "gram";

  let sameserver = false;
  let uitserver = false;
  if(window.location.hostname === "") {
    this.hostname = "localhost";
    this.port = "2737";
    this.protocol = "http:";
    this.subdir = "";
  }
  else if(sameserver) {
    this.hostname = window.location.hostname;
    this.port = window.location.port;
    this.protocol = window.location.protocol;
    this.subdir = "/apy";
  }
  else if(uitserver) {
    this.hostname = "gtweb.uit.no";
    this.port = window.location.protocol === "https:" ? 443 : 80;
    this.protocol = window.location.protocol;
    this.subdir = "/apy";
  }
  else {
    this.hostname = "192.168.22.60";
    this.port = "2737";
    this.protocol = window.location.protocol;
    this.subdir = "";
  }

  // TODO: apy should have an endpoint for grammar checkers, and expect its modes files in a separate dir!
  // (endpoint both for listing and "translate")
  this.modesUrl = this.protocol+"//"+this.hostname+":"+(this.port.toString())+this.subdir+"/listPairs";
  this.checkUrl = this.protocol+"//"+this.hostname+":"+(this.port.toString())+this.subdir+"/translateRaw";
  log(this.checkUrl);

  $(editorWrapper).click(ErrorBlot.hiderep);
  $("body").click(ErrorBlot.hiderep);

  initSpinner(editorWrapper);

  this.getModes();
  this.mode = mode;

  $.ajaxSetup({
    statusCode: {
      "401": function(){
        // showLogin();
      }
    }
  });

  this.quill.on('text-change', this.onTextChange.bind(this));
  this.quill.on('selection-change', this.onSelectionChange.bind(this));

  this.clearErrs();
  ErrorBlot.hiderep();
  if(false) {                   // ignores TODO
    this.updateIgnored();
  }
  this.wwTexts = wwTexts;       // "const", don't change this elsewhere
  this.quill.setContents({
    ops: this.wwTexts.map(function(t){ return { insert: t + self.wwSep }; })
  });
  this.check();
};

DivvunEditor.prototype.wwSep = "❡\n";

DivvunEditor.prototype.cancel = function()/*: void*/ {
  this.editorWrapper.remove();
  if(!EditorTextSdk.cancelTransaction()) {
    alert("Failed to cancel transaction, WoodWing says: " + EditorTextSdk.getErrorMessage());
  }
};

var diff2reps = function (orig/*:Delta*/, changed/*:Delta*/)/*:Array<{ beg: number, end: number, rep: string }>*/ {
  let d = orig.diff(changed);
  // Find the index of the last change in orig:
  var iEnd = 0;
  for(let i = 0; i < d.ops.length; i++) {
    if(d.ops[i].retain){ iEnd += d.ops[i].retain; }
    if(d.ops[i].delete){ iEnd += d.ops[i].delete; }
    if(d.ops[i].insert){ }
  }
  // Starting from the end, create a list of replacements, taking our
  // end-index down with us:
  var reps = [];
  for(let i = d.ops.length - 1; i >= 0; i--) {
    if(d.ops[i].retain){
      iEnd -= d.ops[i].retain;
    };
    if(d.ops[i].delete){
      reps.push({ beg: iEnd - d.ops[i].delete,
                  end: iEnd,
                  rep: "" });
      iEnd -= d.ops[i].delete;
    };
    if(d.ops[i].insert){
      reps.push({ beg: iEnd,
                  end: iEnd,
                  rep: d.ops[i].insert });
    }
  }
  return reps;
};

DivvunEditor.prototype.exitAndApply = function()/*: void*/ {
  let texts = this.getFText().split(this.wwSep);

  if(texts[texts.length - 1] !== "") {
    console.warn("Unexpected non-empty last element of checked Divvun texts: ", texts[texts.length - 1]);
    // TODO: What would this imply?
  }

  if (texts.length !== this.wwTexts.length + 1) {
    console.warn("Unexpected length difference in WoodWing getTexts() and checked Divvun texts!");
    console.warn(texts);
    console.warn(this.wwTexts);
    alert("Unexpected length difference in WoodWing and checked Divvun texts, not applying changes.");
    // Be conservative here, this could be bad.
    return this.cancel();
  }


  var textsOff = 0;
  for (let iText = 0; iText < texts.length - 1; iText++) {
    let endIncSep = texts[iText].length + this.wwSep.length;
    let orig = new Delta({ ops: [{ insert: this.wwTexts[iText] + this.wwSep }]});
    let changed = this.quill.getContents(textsOff, endIncSep);
    diff2reps(orig, changed).map(function(r) {
      console.log("In component " + iText + ", replace substring from " + r.beg + " to " + r.end + " with '" + r.rep + "'");
      if (!EditorTextSdk.replaceText(iText, r.beg, r.end, r.rep)) {
        console.warn('Could not replaceText due to error ' + EditorTextSdk.getErrorMessage());
      }
    });
    textsOff += endIncSep;
  }

  this.editorWrapper.remove();
  if(!EditorTextSdk.closeTransaction()) {
    alert("Failed to close transaction, WoodWing says: " + EditorTextSdk.getErrorMessage());
  }
};

DivvunEditor.prototype.getModes = function()/*: void*/ {
  let self = this;
  this.modes = {};
  let _xhr = $.ajax(this.modesUrl, {
    type: "GET",
    data: {},
    success: function(res){
      let modelist/*:Array<mode>*/ = res.responseData.map(function(m) {
        let src = m.sourceLanguage;
        let trg = m.targetLanguage;
        let trgsuff = trg.replace(/^[^_]*_/, "");
        let trglang = trg.replace(/_.*/, "");
        return { src: src, trglang: trglang, trgsuff: trgsuff };
      }).filter(function(mm) {
        return mm.src == mm.trglang && mm.trgsuff.match(/^gram/);
      });
      // skewer.log(modes);
      Array.from(groupBy(modelist, (m) => { return m["src"]; }).entries()).map(function([k, elts]){
        self.modes[k] = elts;
        // elts.forEach(modeToDropdown); // TODO: modes settable?
      });
    },
    dataType: "json"
  });
};

DivvunEditor.prototype.replaceErr = function(e) {
  ErrorBlot.hiderep();
  var delta = { ops:[
    { retain: e.data.beg },
    { delete: e.data.len },
    { insert: e.data.r }
  ]};
  // source=user since user clicked "replace":
  this.quill.updateContents(delta, "user");
  this.atMostOneSpace(e.data.beg);
  // TODO: Do we want checkOnIdle at all when batching?
  // this.checkOnIdle();
  this.quill.focus();
};

DivvunEditor.prototype.onSelectionChange = function(range, _oldRange, source) {
  if(range != null && range.length === 0 && source === 'user') {
    var erroroffset = this.quill.scroll.descendant(ErrorBlot, range.index),
        error/*:ErrorBlot*/ = erroroffset[0],
        offset = erroroffset[1];
    if(error != null) {
      if($(error.domNode).data("error")) {
        var beg = range.index - offset,
            len = error.length();
        error.showrep(beg, len, this);
      }
      else {
        console.log("descendant ErrorBlot at", range.index, "had no data, clearing markup");
        this.quill.formatText(range.index - offset, error.length(), "error", false);
      }
    }
  }
};

DivvunEditor.prototype.atMostOneSpace = function(i) {
  var t = this.getFText();
  while(t[i-1] == " ") {
    i--;
  }
  var len = 0;
  while(t[i+len] == " ") {
    len++;
  }
  // If there were more than two spaces, leave just one:
  if(len > 1) {
    this.quill.deleteText(i, len-1, "user");
  }
};

DivvunEditor.prototype.clearErrs = function () {
  this.quill.formatText(0, this.quill.getLength(), "error", false);
};

DivvunEditor.prototype.removeIgnored = function (e) {
  var igntyps = safeGetItem("igntyps", new Set());
  igntyps.delete(e.data.typ);
  safeSetItem("igntyps", igntyps);
  this.updateIgnored();
  this.check();
};

DivvunEditor.prototype.updateIgnored = function()/*:void*/
{
  var igntyps = safeGetItem("igntyps", new Set());
  var ign = $('#igntyps');
  ign.empty();
  if(igntyps.size > 0) {
    igntyps.forEach(function(typ){
      let a =
          $('<a class="glyphicon glyphicon-remove pull-right">')
          .click({ typ: typ }, this.removeIgnored.bind(this))
          .text("𐄂");
      let elt =
          $('<li class="ma2">')
          .text(typ)
          .append(a);
      ign.append(elt);
    });
  }
  else {
    var elt = $(document.createElement('li'));
    l10n().formatValue('hide_errtype_explanation').then(function(t){ elt.text(t); });
    ign.append(elt);
  }
  $('#igntyps-wrapper button').addClass('glyphicon glyphicon-refresh glyphicon-refresh-animate  ');
  $('#igntyps-wrapper button').removeClass('glyphicon glyphicon-refresh glyphicon-refresh-animate  ');
};

var mergeErrs = function(errs/*:errlist*/)/*:errlist*/ {
  let byIndices = groupBy(errs, (x) => {
    return x[1].toString() + "→" + x[2].toString(); // beg→end
  });
  return Array.from(byIndices.values()).map((val) => {
    if(val.length > 1) {
      return val.reduce((x1, x2) => {
        // TODO: What's the best way of representing overlapping errors here?
        return [x1[0],
                x1[1],
                x1[2],
                x1[3] + "/" + x2[3],
                x1[4] + "\n / \n" + x2[4],
                x1[5].concat(x2[5])
               ];
      });
    }
    else {
      return val[0];
    }
  });
};

DivvunEditor.prototype.applyErrs = function(text, res/*:result*/, off/*:number*/) {
  var igntyps = safeGetItem("igntyps", new Set());
  let mergedErrs = mergeErrs(res.errs);
  mergedErrs.forEach((x) => {
    var length = x[2] - x[1];
    var err = {
      str: x[0],
      beg: x[1] + off,
      end: x[2] + off,
      len: length,
      typ: x[3],
      rep: x[5],
      msg: x[4]
    };
    if(false && igntyps.has(err.typ)) { // ignores TODO
      return;
    }
    if(err.str !== text.substr(err.beg, err.len)) {
      // TODO: should we fail/skip if form differs?
      console.warn("Unexpected difference between error string '" + err.str + "' and text at error indices '" + text.substr(err.beg, err.len) + "'");
    }
    this.quill.formatText(err.beg,
                          err.len,
                          "error",
                          err);
  });
  log(res);
  $("#divvun-serverfault").hide();
};


// quill.formatText treats videos/images as having a length of one,
// while quill.getText treats them as having a length of zero – the
// following allows round-tripping without mixing up indices:
DivvunEditor.prototype.getFText = function() {
  return this.quill
    .getContents()
    .ops
    .map(function(op) {
      return typeof op.insert === 'string' ? op.insert : ' ';
    })
    .join('');
};

DivvunEditor.prototype.checkXHR = [];
DivvunEditor.prototype.servercheck = function(userpass/*:userpass*/, text/*:string*/, off/*:number*/, cb/*:cb*/, mode/*:string*/)/*:JQueryXHR*/ {
  console.log("servercheck", off, mode, text);
  // TODO: Should this be synchronous? We can't really change the text
  // after the user has typed unless the text still matches what we
  // sent.
  return $.ajax(this.checkUrl, {
    beforeSend: function(xhr) {
      xhr.setRequestHeader("Authorization", basicAuthHeader(userpass));
    },
    type: "POST",
    data: {
      langpair: mode,
      q: text
    },
    success: function(res) {
      console.log("servercheck_success", off, res);
      cb(text, res, off);
    },
    error: function(jqXHR, textStatus/*:string*/, errXHR/*:string*/)/*:void*/ {
      console.log("error: "+textStatus+"\n"+errXHR);
      console.log(jqXHR);
      console.log(jqXHR.status);
      if(textStatus === "abort" && jqXHR.status === 0) {
        // So the user clicked before the server managed to respond, no problem.
        return;
      }
      else if(textStatus === "parsererror" && jqXHR.status === 200) {
        l10n().formatValue('parserfail',
                           { errorCode: jqXHR.status + " " + errXHR,
                             textStatus: textStatus })
          .then(function(t){
            $("#divvun-serverfault").html(t).show();
          });
      }
      else if(textStatus === "error" && jqXHR.status === 0) {
        l10n().formatValue('serverdown')
          .then(function(t){
            $("#divvun-serverfault").html(t).show();
          });
      }
      else {
        l10n().formatValue('loginfail',
                           { errorCode: jqXHR.status + " " + errXHR,
                             textStatus: textStatus })
          .then(function(t){
            $("#divvun-serverfault").html(t).show();
          });
        $("#divvun-serverfault").show();
      }
    },
    dataType: "json"
  });
};

DivvunEditor.prototype.getLang = function(search) {
  if(search.lang !== undefined) {
    return search.lang;
  }
  else {
    return this.DEFAULT_LANG;
  }
};

DivvunEditor.prototype.getVariant = function(search) {
  if(search.variant !== undefined) {
    return search.variant;
  }
  else {
    return this.DEFAULT_VARIANT;
  }
};

DivvunEditor.prototype.check = function() {
  // var mode = langToMode(this.getLang(searchToObject()), this.getVariant(searchToObject()));
  let mode = this.mode;         // TODO: mode settable?
  this.clearErrs();
  let text = this.getFText();

  // TODO: can we dispense with this username stuff soon?
  let userpass = { u: "ávvir", p: "test" };

  while(this.checkXHR.length > 0) {
    // We only ever want to have the latest check results:
    this.checkXHR.pop().abort();
  }
  this.checkSubText(userpass, text, 0, mode);
};

DivvunEditor.prototype.checkSubText = function(userpass/*:userpass*/, text/*:string*/, off/*:number*/, mode/*:string*/)/*:void*/ {
  let max = textCutOff(text.substr(off), APYMAXBYTES);
  let subtext = text.substr(off, max);
  let next_off = off + max;
  if(next_off < text.length) {
    let cont = function(t, res, o) {
      this.checkSubText(userpass, text, next_off, mode);
      this.applyErrs(t, res, o);
    };
    this.checkXHR.push(this.servercheck(userpass, subtext, off, cont.bind(this), mode));
  }
  else {
    this.checkXHR.push(this.servercheck(userpass, subtext, off, this.applyErrs.bind(this), mode));
  }
};

DivvunEditor.prototype.idleTimer = null;
DivvunEditor.prototype.checkOnIdle = function(delay=7000) {
  window.clearTimeout(this.idleTimer);
  this.idleTimer = window.setTimeout(this.check.bind(this), delay);
};

DivvunEditor.prototype.onTextChange = function(delta, oldDelta, source) {
  if (source == 'api') {
  }
  else if (source == 'user') {
    // Note that our own replaceErr events are also source==user
    ErrorBlot.hiderep();
    // this.checkOnIdle();
  }
};


function utoa(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1/*:number*/) {
      return String.fromCharCode(parseInt('0x' + p1));
    }));
}

var basicAuthHeader = function (userpass) {
  return "Basic " + utoa(userpass.u + ":" + userpass.p);
};

var langToMode = function(lang/*:string*/, variant/*:string*/)/*:string*/ {
  return lang + "|" + lang + "_" + variant;
};

var modeToDropdown = function(m/*:mode*/)/*:void*/ {
  let a =
      $('<a>')
      .text(m.src + "_" + m.trgsuff)
      .on('click', function(_ev) {
        window.location.search = '?lang=' + m.src + "&variant=" + m.trgsuff;
      });
  let li =
      $('<li class="mode ma2">')
      .append(a);
  $('#modes').append(li);
};



var initSpinner = function(editorElement/*:string|HTMLElement*/) {
    $("#spinner").hide();
    $(editorElement).removeClass("divvun-loading");
    $(document)
      .ajaxStart(function () {
        $("#spinner").show();
        $("#editor").addClass("divvun-loading");
        $(".ql-check").addClass("glyphicon glyphicon-refresh spinning");
        $(".ql-check").addClass("divvun-loading-check");
      })
      .ajaxStop(function () {
        $("#spinner").hide();
        $("#editor").removeClass("divvun-loading");
        $(".ql-check").removeClass("glyphicon glyphicon-refresh spinning");
        $(".ql-check").removeClass("divvun-loading-check");
      });
};



var groupBy = function/*::<T:any, K:any>*/(list/*:Array<T>*/, keyGetter/*:(T => K)*/)/*:Map<K, Array<T>>*/ {
    const map = new Map();
    list.forEach((item) => {
        const key = keyGetter(item);
        const collection = map.get(key);
        if (!collection) {
            map.set(key, [item]);
        } else {
            collection.push(item);
        }
    });
    return map;
};


var searchToObject = function () {
  // like http://stackoverflow.com/a/7090123/69663 but check for '='
  var pairs = window.location.search.substring(1).split("&"),
      obj = {};
  for (var i in pairs) {
    if (pairs[i].indexOf('=') > -1) {
      var pair = pairs[i].split("=");
      var key = pair[0],
          val = pair[1].replace(/\+/g, '%20');
      obj[decodeURIComponent(key)] = decodeURIComponent(val);
    }
  }
  return obj;
};

var safeSetItem = function/*::<T>*/(key/*:string*/, value/*:T*/)/*:void*/ {
  if(value && value.constructor && value.constructor.name === "Set") {
    // $FlowFixMe
    window.localStorage.setItem(key, JSON.stringify(Array.from(value)));
  }
  else {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
};

var safeGetItem = function/*::<T>*/(key/*:string*/, fallback/*:T*/)/*:T*/ {
  var fromStorage = window.localStorage.getItem(key);
  if(fromStorage == null) {
    return fallback;
  }
  else {
    try {
      var parsed = JSON.parse(fromStorage);
      if(parsed != null) {
        if(fallback && fallback.constructor && fallback.constructor.name === "Set") {
          // $FlowFixMe
          return new Set(parsed);
        }
        else{
          return parsed;
        }
      }
    }
    catch(e) {
      console.log(e);
    }
    return fallback;
  }
};



let overrideWwSpellcheck = function() {
  // Override browser-spellcheck setting on the main editor. We would
  // like to do this at once from init, but it seems woodwing turns on
  // spellcheck after our init runs, thus doing it from mkQuill and
  // timer
  $(".writr").attr("spellcheck", "false");
};

/* Should check if it's been run so we don't get a bunch of editors */
var mkQuill = function() {
  $('#divvun-editor').remove();
  if(!EditorTextSdk.canEditArticle()) {
    alert("WoodWing says we can't edit the article.");
  }
  if(!EditorTextSdk.startTransaction()) {
    alert("Failed to start transaction, WoodWing says: " + EditorTextSdk.getErrorMessage());
    // Did we start one already? This seems to happen with undos.
    if(!EditorTextSdk.cancelTransaction()) {
      alert("Failed to cancel transaction, WoodWing says: " + EditorTextSdk.getErrorMessage());
    }
    return;
  }
  let editorWrapper = $('<div id="divvun-editor">');
  $(window.document.body).append(editorWrapper);
  // div ^ has to exist in document before we do ↓
  // var mode = "sme|sme_gram";   // TODO: mode settable?
  var mode = "sme|sme_spell";
  let wwTexts = EditorTextSdk.getTexts();
  let editor = new DivvunEditor(editorWrapper.get()[0], mode, wwTexts);
  overrideWwSpellcheck();
};

let PLUGINDIR = "../../config/plugins/divvungc/";

/* Should only run once */
var initCss = function(file) {
  var el = $('<link/>');
  el.attr('rel', 'stylesheet');
  el.attr('href', file);
  $('head').append(el);
};

/* Should only run once */
var init = function() {
  initCss(PLUGINDIR + "quill.snow.css");
  initCss(PLUGINDIR + "style.css?2");
  initL10n("sme", PLUGINDIR);              // TODO: hardcodedlang
  var subMenuId = EditorUiSdk.createAction({
    label: 'Divvun',
    icon: PLUGINDIR + "divvun.ico",
    click: mkQuill
  });
  window.setTimeout(overrideWwSpellcheck, 3000);
};

init();
