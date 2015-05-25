Ext.define('Voyant.panel.DToC.Reader', {
	extend: 'Ext.panel.Panel',
	requires: [],
	mixins: ['Voyant.panel.Panel'],
	alias: 'widget.dtocReader',
    config: {
    	corpus: undefined
    },
    statics: {
        api: {
        	docId: undefined
        }
    },
    
    toolTipConfig: {
		cls: 'dtcReaderNote',
		showDelay: 50,
		draggable: true,
		constrainPosition: true,
		border: false,
		shadow: false,
		padding: 5,
		maxWidth: 400
	},
    
    MINIMUM_LIMIT: 1000,
	currentDocId: null,
	loading: false,
	readerContainer: null,
	prevButton: null,
	nextButton: null,
    
    constructor: function(config) {
    	
    	Ext.applyIf(config, {
			baseCls: 'x-plain dtc-panel',
			height: '100%',
			html: '<div id="dtcReaderContainer"><div id="dtcReaderDivWrapper"></div><div id="dtcReaderButtons"></div></div>'
		});
    	
        this.callParent(arguments);
    	this.mixins['Voyant.panel.Panel'].constructor.apply(this, arguments);
    	
    	this.addListener('afterrender', function(panel) {
			this.readerContainer = Ext.get('dtcReaderContainer');
			
			var buttonContainer = Ext.get('dtcReaderButtons');
			
			this.prevButton = new Ext.Button({
				text: 'Previous Chapter',
				scale: 'medium',
				style: 'display: inline-block; margin-right: 5px;',
				renderTo: buttonContainer,
				handler: this.fetchPreviousDocument,
				scope: this
			});
			
			
			this.nextButton = new Ext.Button({
				text: 'Next Chapter',
				scale: 'medium',
				style: 'display: inline-block; margin-left: 5px;',
				renderTo: buttonContainer,
				handler: this.fetchNextDocument,
				scope: this
			});
			
			this.readerContainer.addListener('scroll', function(ev) {
				this.getApplication().dispatchEvent('dtcReaderScroll', this, {el: ev.target, docId: this.currentDocId});
			}, this);
		}, this);
		
		this.addListener('afterlayout', function(panel, layout) {
			this.resizeReaderComponents();
		}, this);
		
		this.addListener('corpusDocumentSelected', function(src, data) {
			if (this.currentDocId != data.docId) {
				this.setApiParams({docId: data.docId, start: 0});
				
				this.fetchText(function() {
					if (data.tokenId) {
						this.highlightToken(data.tokenId);
					} else {
						this.getApplication().dispatchEvent('dtcReaderScroll', this, {el: this.readerContainer.dom, docId: data.docId});
					}
				});
			} else {
				if (data.tokenId) {
					this.highlightToken(data.tokenId);
				} else {
					this.readerContainer.scrollTo('top', 0, false);
				}
			}
		}, this);
		
		this._doScrollTo = function(src, data, animate) {
			if (this.currentDocId != data.docId) {
				this.setApiParams({docId: data.docId, start: 0});
				
				this.fetchText(function() {
					var dom = this.readerContainer.dom;
					var scrollTop = data.amount * dom.scrollHeight - (dom.clientHeight * 0.5);
					this.readerContainer.scrollTo('top', scrollTop, animate);
				});
			} else {
				var dom = this.readerContainer.dom;
				var scrollTop = data.amount * dom.scrollHeight - (dom.clientHeight * 0.5);
				this.readerContainer.scrollTo('top', scrollTop, animate);
			}
		};
		this.addListener('dtcDocModelClick', function(src, data) {
			this._doScrollTo(src, data, true);
		}, this);
		this.addListener('dtcDocModelScroll', function(src, data) {
			this._doScrollTo(src, data, null);
		}, this);
		
		/**
		 * @event TokensResultLoaded
		 * @type listener
		 */
		this.addListener('TokensResultLoaded', function(src, data) {
			var content = "";
			var docs = data.tokens.documents;
			var toks, category;
			for (var i=0;i<docs.length;i++) {
				toks = docs[i].tokens;
				for (var j=0;j<toks.length;j++) {
					category = toks[j]['@category'];
					if (category.indexOf("TAG")>-1) {
						if (toks[j]['@newline']) {
							content+='<br />';
						}
					}
					else {content+=toks[j]['@token'];}
				}
			}
			var el = this.body.last();
			el.update(content);
		}, this);
		
		/**
		 * @event tokenSelected
		 * @type listener
		 */
		this.addListener('tokenSelected', function(src, data) {
			if (this.currentDocId != data.docId) {
				this.setApiParams({docId: data.docId});
				this.fetchText(function() {
					this.scrollToToken(data.tokenId);
				});
			} else {
				this.scrollToToken(data.tokenId);
			}
		}, this);
		
		this.addListener('tagSelected', function(src, data) {
			if (data.docId != this.currentDocId) {
				this.setApiParams({docId: data.docId});
				this.fetchText(function() {
					this.scrollToToken(data.tokenId);
				});
			} else {
				this.scrollToToken(data.tokenId);
			}
		}, this);
		
		/**
		 * @event documentTypeSelected
		 * @type listener
		 */
		this.addListener('documentTypeSelected', function(src, data) {
			var docInfo = data.docIdType.split(':');
			var docId = docInfo[0];
//			var type = docInfo[1].toLowerCase();
//			this.search.setValue(type);
			if (data.tokenIdStart) {
				this.setApiParams({docId: docId, start: data.tokenIdStart});
				this.fetchText();
			} else {
				
			}
		}, this);
		
		this.addListener('tagsSelected', function(src, tags) {
			this.clearHighlights('tag');
			for (var i = 0; i < tags.length; i++) {
				var docTags = tags[i];
				for (var j = 0; j < docTags.length; j++) {
					var tag = docTags[j];
					this.highlightTag({docId: tag.docId, tokenId: tag.tokenId, type: 'tag'});
				}
			}
		}, this);
		
		this.addListener('indexesSelected', function(src, indexes) {
			this.clearHighlights('index');
			for (var i = 0; i < indexes.length; i++) {
				var index = indexes[i];
				index.type = 'index';
				this.highlightTag(index);
			}
		}, this);
		
		this.addListener('corpusTermsClicked', function(src, terms) {
			if (terms.length === 0) {
				this.clearHighlights('kwic');
			}
		}, this);
		
		this.addListener('tocUpdated', function(src, data) {
			this.clearHighlights('kwic');
			if (!Ext.isArray(data)) {
				data = [data];
			}
			for (var i = 0; i < data.length; i++) {
				var d = data[i];
				this.highlightTag(d);
			}
		}, this);
    },
    initComponent: function() {
        var me = this;
        
        me.callParent(arguments);
    },
    
	listeners: {
		afterrender: function(container) {
				
		},
		loadedCorpus: function(src, corpus) {
			this.setCorpus(corpus);
			
			var docId = this.getApiParams().docId;
			if (docId == null) docId = this.getCorpus().getDocument(0).getId();
			this.getApplication().dispatchEvent('corpusDocumentSelected', this, {docId: docId});
		}
	},
	
	fetchText: function(callback) {
		var params = this.getApiParams();
		Ext.apply(params, {
			corpus: this.getCorpus().getId(),
			start: 0,
			limit: 0
		});
		Ext.apply(params, {
			tool: 'corpus.DocumentTokens',
			template: 'docTokensPlusStructure2html',
			outputFormat: 'html'
		});

		if (!params.docId) {
			params.docId = this.getCorpus().getDocument(0).getId();
		}
		
		this.currentDocId = params.docId;
		
		if (window.history.pushState) {
			// add the docId to the url (for proper annotation storage)
//			var app = this.getApplication();
//			var url = app.getBaseUrl()+'?';
//			url += 'skin=dtc&';
//			url += 'corpus='+app.getCorpus().getId()+'&';
//			url += 'docId='+params.docId+'&';
//			for (var key in app.query) {
//				if (key != 'skin' && key != 'corpus' && key != 'docId') {
//					url += key+'='+app.query[key]+'&'
//				}
//			}
//			url = url.substring(0, url.length-1);
//			window.history.pushState({
//				corpus: app.getCorpus().getId(),
//				docId: params.docId
//			}, 'Doc: '+params.docId, url);
		}
		
		this.setReaderTitle();
		
		this.prevButton.hide();
		this.nextButton.hide();
		
		var el = Ext.get(Ext.DomQuery.select('#dtcReaderDivWrapper')[0]);
		el.update('');
		
		this.loading = true;
		el.load({
			url: this.getTromboneUrl(),
			params: params,
			callback: function(el, success, response, options) {
				this.loading = false;
				
				this.getApplication().dispatchEvent('dtcDocumentLoaded', this, {docId:this.currentDocId});
				
				if (this.getIndexForDocId(params.docId) > 0) {
					this.prevButton.show();
				}
				if (this.getIndexForDocId(params.docId) < this.getCorpus().getDocumentsCount()) {
					this.nextButton.show();
				}
				
				this._processHeader();
				
				this.tokenToolTipsMap = {};
				this._processNotes();
				this._processBibls();
				this._processImages();
				
				this._getSelections();
				
				if (callback) callback.call(this);
			},
			scope: this
		});
	},
	
	fetchPreviousDocument: function() {
		var index = this.getIndexForDocId(this.currentDocId);
		if (index > 0) {
			var docId = this.getCorpus().getDocument(index-1).getId();
			this.getApplication().dispatchEvent('corpusDocumentSelected', this, {docId:docId});
		}
	},
	
	fetchNextDocument: function() {
		var index = this.getIndexForDocId(this.currentDocId);
		if (index < this.getCorpus().getDocumentsCount()) {
			var docId = this.getCorpus().getDocument(index+1).getId();
			this.getApplication().dispatchEvent('corpusDocumentSelected', this, {docId:docId});
		}
	},
	
	_processHeader: function() {
		var header = Ext.get(Ext.DomQuery.select('xmlHead', this.readerContainer.dom)[0]);
		if (header != null) {
			header.setVisibilityMode(Ext.Element.DISPLAY);
			header.hide();
		}
		var byline = Ext.get(Ext.DomQuery.select('byline', this.readerContainer.dom)[0]);
        if (byline != null) {
            byline.setVisibilityMode(Ext.Element.DISPLAY);
            byline.hide();
        }
		var docauthors = Ext.DomQuery.select('docAuthor', this.readerContainer.dom);
		for (var i = 0; i < docauthors.length; i++) {
		    var docauthor = Ext.get(docauthors[i]);
		    docauthor.setVisibilityMode(Ext.Element.DISPLAY);
            docauthor.hide();
		}
		var firstP = Ext.get(Ext.DomQuery.select('div[type="chapter"] > p', this.readerContainer.dom)[0]);
		if (firstP != null) {
			firstP.addCls('firstParagraph');
			var firstSpan = firstP.child('span');
			if (firstSpan) {
				var text = Ext.isIE ? firstSpan.dom.text : firstSpan.dom.textContent;
				var dropText = '<span class="dropCap">'+text.substring(0, 1)+'</span>'+text.substring(1);
				firstSpan.update(dropText);
			}
		}
	},
	
	_processNotes: function() {
		var notes = Ext.DomQuery.select('note', this.readerContainer.dom);
		for (var i = 0; i < notes.length; i++) {
			var note = notes[i];
			var noteNumber = Ext.DomHelper.insertBefore(note, '<span class="noteNumber">'+(i+1)+'</span>', true);
			var tip = new Ext.ux.DToCToolTip(Ext.apply({
				target: noteNumber,
				title: 'Note '+(i+1),
				html: Ext.isIE ? note.text : note.textContent
			}, this.toolTipConfig));
			var tokenId = note.getAttribute('tokenid');
			this.tokenToolTipsMap[tokenId] = tip;
		}
	},
	
	_processBibls: function() {
		var bibls = Ext.DomQuery.select('list > item > bibl', this.readerContainer.dom);
		for (var i = 0; i < bibls.length; i++) {
			var bibl = bibls[i];
			var id = bibl.getAttribute('xml:id');
			if (id != null) {
				var refs = Ext.DomQuery.select('ref[target*='+id+']', this.readerContainer.dom);
				for (var j = 0; j < refs.length; j++) {
					var ref = refs[j];
					var biblNumber = Ext.DomHelper.insertAfter(ref, '<span class="noteNumber">'+(i+1)+'</span>', true);
					var tip = new Ext.ToolTip(Ext.apply({
						target: biblNumber,
						title: 'Bibl. Ref. '+(i+1),
						html: bibl.textContent
					}, this.toolTipConfig));
					
					var tokenId = ref.getAttribute('tokenid');
					this.tokenToolTipsMap[tokenId] = tip;
					
//					biblNumber.on('click', function(b, e, el, o) {
//						b.scrollIntoView(this.readerContainer.dom);
//					}.bind(this, [bibl]));
				}
			}
		}
	},
	
	_processImages: function() {
		var images = Ext.DomQuery.select('graphic', this.readerContainer.dom);
		for (var i = 0; i < images.length; i++) {
			var image = images[i];
			var url = image.getAttribute('url');
			var noteNumber = Ext.DomHelper.insertBefore(image, '<img src="'+url+'" />', true);
		}
	},
	
	_getSelections: function() {
		var sels = Ext.getCmp('dtcDocModel').getSelectionsForDoc(this.currentDocId);
		for (var type in sels) {
			var tokenIds = sels[type];
			for (var id in tokenIds) {
				this.highlightTag({docId: this.currentDocId, tokenId: id, type: type});
			}
		}
	},
	
	highlightKeywords: function(query, doScroll) {
		if (!Ext.isArray(query)) query = [query];
		
		var nodes = Ext.DomQuery.select('span[class*=keyword]', this.readerContainer.dom);
		for (var i=0; i<nodes.length;i++) {
			Ext.get(nodes[i]).removeCls('keyword');
		}
		nodes = [];
		for (var i = 0; i < query.length; i++) {
			nodes = nodes.concat(Ext.DomQuery.select('span.token:nodeValueCaseInsensitive('+query[i]+')', this.readerContainer.dom));
		}
		if (nodes.length>0) {			
			for (var i=0; i<nodes.length;i++) {
				Ext.get(nodes[i]).addCls('keyword');
			}
			if (doScroll) Ext.get(nodes[0]).scrollIntoView(this.readerContainer).frame("#F47922", 1, { duration: 1000 });
		}
	},
	
	highlightToken: function(tokenId) {
		var tag = Ext.DomQuery.select('*[tokenid="'+tokenId+'"]', this.readerContainer.dom)[0];
		if (tag != null) {
			this._doHighlight(tag, 'kwic');
		}
	},
	
	/**
	 * A general highlight function, expects any of the following data properties: id, tokenId, or tag & index.
	 */
	highlightTag: function(data) {
		if (data.docId && data.docId == this.currentDocId) {
			var tag = null;
			if (data.id) {
				tag = Ext.DomQuery.select('*[xml\\:id="'+data.id+'"]', this.readerContainer.dom)[0];
			} else if (data.tokenId) {
				tag = Ext.DomQuery.select('*[tokenid="'+data.tokenId+'"]', this.readerContainer.dom)[0];
			} else if (data.tag) {
				tag = Ext.DomQuery.select(data.tag, this.readerContainer.dom)[data.index];
			} else if (data.xpath) {
				
			} 
			if (tag != null) {
				this._doHighlight(tag, data.type);
			}
		}
	},
	
	_doHighlight: function(tag, type) {
		var type = type || 'index';
		var tagEl = Ext.get(tag);
		tagEl.addCls('dtc-reader-highlight');
		tagEl.addCls(type);
	},
	
	scrollToToken: function(tokenId) {
		var readerEl = this.readerContainer.dom;
		var tag = Ext.get(Ext.DomQuery.select('*[tokenid="'+tokenId+'"]', readerEl)[0]);
		
		if (tag) {
		    var isVisible = tag.isVisible(true); // true to check if parents are visible
		    if (!isVisible) {
		        // if the tag has a note parent then reset the tokenId to that of the note
		        var noteParent = tag.parent('note');
		        if (noteParent != null) {
		            tokenId = noteParent.getAttribute('tokenid');
		        }
		    }
		    
    		var tip = this.tokenToolTipsMap[tokenId];
    		if (tip) {
    		    tip.target.scrollIntoView(readerEl);
    		} else {
    		    tag.scrollIntoView(readerEl);
    		}
    		
    		if (tip) {
    			var xy = tip.target.getXY();
    			tip.targetXY = xy;
    			setTimeout(function() {
    				tip.show();
    				tip.showCloseButton();
    			}, 500);
    		} else {
    			var color = '#F47922';
    			if (tag.hasCls('tag')) {
    				color = '#249EF5';
    			} else if (tag.hasCls('kwic')) {
    				color = '#E324F5';
    			}
    			tag.frame(color, 1, {duration: 1000});
    		}
		}
	},
	
	clearHighlights: function(type) {
		var readerEl = this.readerContainer.dom;
		var hits = Ext.DomQuery.jsSelect('*[class*=dtc-reader-highlight]', readerEl);
		for (var i = 0; i < hits.length; i++) {
			var hit = Ext.get(hits[i]);
			if (type == null || hit.hasCls(type)) {
				hit.removeCls('dtc-reader-highlight');
			}
		}
	},
	
	getSegmentObject: function(segment) {
		var className = segment.className ? segment.className : segment.dom.className;
		var segmentRegex = /segment_(\d+)_(\d+)_(\d+)/;
		var match = segmentRegex.exec(className);
		if (match) {
			return {
				element: segment,
				docIndex: parseInt(match[1]),
				start: parseInt(match[2]),
				lastLimit: parseInt(match[3])
			};
		}
		return {};
	},
	
	getCurrentDocId: function() {
		return this.currentDocId;
	},
	
	getIndexForDocId: function(docId) {
		return this.getCorpus().getDocument(docId).getIndex();
	},
	
	setReaderTitle: function(docId) {
		docId = docId || this.currentDocId;
		var doc = this.getCorpus().getDocument(docId);
		var title = doc.get('title').normalize();
		var surnames = '';
		var authors = doc.get('author');
		if (typeof authors === 'string') {
			authors = [{surname: authors}];
		}
		for (var i = 0; i < authors.length; i++) {
			if (i > 0) {
				if (authors.length > 2) surnames += ', ';
				if (i == authors.length - 1) {
					surnames += ' and ';
				}
			}
			surnames += authors[i].surname;
		}
		this.setTitle('<span class="author">'+surnames+'</span>: <span class="title">'+title+'</span>');
		
		this.resizeReaderComponents();
	},
	
	resizeReaderComponents: function() {
//		var headerHeight = this.header.getHeight();
//		this.readerContainer.setTop(headerHeight+'px');
//		var panelHeight = this.ownerCt.getHeight();
//		var borderHeight = this.el.getBorderWidth('tb');
//		this.body.setHeight(panelHeight - borderHeight - headerHeight);
	},
	
	setReaderScroll: function(location) {
		location = location || 'bottom';
		var scrollTop = 0;
		if (location == 'bottom') {
			scrollTop = this.readerContainer.dom.scrollHeight;
		}
		this.readerContainer.scrollTo('top', scrollTop, false);
	},
	
	_getDocumentXml: function(docId, callback) {
		var params = {
			tool: 'corpus.DocumentTokens',
			corpus: this.getCorpus().getId(),
			docId: docId,
			template: 'docTokensPlusStructure2html',
			outputFormat: 'html',
			limit: 0
		};
		Ext.Ajax.request({
           url: this.getTromboneUrl(),
           params: params,
           success: function(response, options) {
				if (callback) callback(response.responseXML);
           },
           scope: this
        });
	}
});

//scroll element into the centre of the container
Ext.override(Ext.Element, {
	scrollIntoView : function(container, hscroll) {
		var c = Ext.getDom(container) || Ext.getBody().dom,
		        el = this.dom,
		        o = this.getOffsetsTo(c),
		    l = o[0] + c.scrollLeft,
		    t = o[1] + c.scrollTop,
		    b = t + el.offsetHeight,
		    r = l + el.offsetWidth,
		        ch = c.clientHeight,
		        ct = parseInt(c.scrollTop, 10),
		        cl = parseInt(c.scrollLeft, 10),
		        cb = ct + ch,
		        cr = cl + c.clientWidth;

	
		// here's the override
		if (el.offsetHeight > ch || t < ct) {
			c.scrollTop = t - ch * 0.5;
		} else if (b > cb) {
			c.scrollTop = b - ch * 0.5;
		}
		
		c.scrollTop = c.scrollTop; // corrects IE, other browsers will ignore
	
		if (hscroll !== false) {
			if (el.offsetWidth > c.clientWidth || l < cl) {
				c.scrollLeft = l;
			} else if (r > cr) {
				c.scrollLeft = r - c.clientWidth;
			}
			c.scrollLeft = c.scrollLeft;
		}
		return this;
	}
});