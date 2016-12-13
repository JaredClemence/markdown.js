/**
 * 
 * Generic interface for Markdown system
 * 
 */
var MarkdownParser = function ()
{
    /**
     * Convert any input into a standardized format for processing
     * @param {mixed} input
     * @returns {standardized data structure}
     */
    var MarkdownReader = function (input) {
        var allFormats = [Html5Format, MarkdownTextFormat];
        var output = {};
        for (var i in allFormats) {

            var formatter = new allFormats[i]();
            try {
                output = formatter.standardize(input);
                //successful parse? then exit loop!
                break;
            } catch (e) {
                console.log(e);
                //not the correct format
                output = {};
            }
        }
        return output;
    };

    var Formatter = function () {};
    Formatter.prototype.standardize = function (inpupt) {
        throw "Standardize function is not set for this object.";
    }

    function MarkdownTextFormat() {}
    MarkdownTextFormat.prototype = Object.create(Formatter.prototype);
    MarkdownTextFormat.prototype.constructor = Html5Format();

    /**
     * Convert a block of markdown text into the StandardObject format.
     * 
     * @param {String} input
     * @returns {StandardObject[*]}
     */
    MarkdownTextFormat.prototype.standardize = function (input) {
        function reduceIndentsTo(line, count) {
            line = removeAllIndents(line);
            while (indent(line) < count) {
                line = "    " + line;
            }
            return line;
        }
        function removeAllIndents(text) {
            return text.trimLeft();
        }
        function removeIndent(text) {
            return text.replace(/^\s{4}/, "");
        }
        function indent(lineText) {
            var indentCount = -1;
            var nowText = lineText, text = null;
            do {
                text = nowText;
                indentCount++;
                nowText = removeIndent(text);
            } while (nowText != text);
            return indentCount;
        }
        function merge(line1, line2) {
            var header       = /^#/;
            var blockquote   = /^>\s{1}/;
            var olli         = /^\d+\.?/;
            var ulli         = /^(?:-|\*)\s/;
            var lineBreak    = /(\\)|(\\\n)$/;
            var lowestIndent = Math.min(indent(line1), indent(line2));
            line1 = reduceIndentsTo(line1, indent(line1) - lowestIndent);
            line2 = reduceIndentsTo(line2, indent(line2) - lowestIndent);
            if (indent(line1) > 0)
                return false;
            if (header.test(line1))
                return false;
            if (blockquote.test(line1) && blockquote.test(line2)) {
                line1 = merge(line1.replace(blockquote, ""), line2.replace(blockquote, ""));
                if (line1) {
                    return reduceIndentsTo("> " + line1, lowestIndent);
                } else {
                    return false;
                }
            }
            if (olli.test(line1)) {
                line1 = merge(line1.replace(olli, ""), removeIndent(line2));
                if (line1) {
                    return reduceIndentsTo("1. " + line1, lowestIndent);
                } else {
                    return false;
                }
            }
            if (ulli.test(line1)) {
                line1 = merge(line1.replace(ulli, ""), removeIndent(line2));
                if (line1) {
                    return reduceIndentsTo("- " + line1, lowestIndent);
                } else {
                    return false;
                }
            }
            if (line1 == "" || line2 == "")
                return false;
            if (olli.test(line2) || ulli.test(line2) || blockquote.test(line2) || header.test(line2))
                return false;
            if (indent(line1) == indent(line2) && lineBreak.test(line1) === false) {
                return reduceIndentsTo((line1 + " " + line2).trim(), lowestIndent);
            }
            return false;
        }
        function combineListItems(obj) {
            var lines = obj.lines;
            var reducing = obj.reducing;
            var skip = true;
            var previousLine = null;
            var curLine = null;
            var line1 = null;
            var line2 = null;
            var indentCount = null;
            var mergedText = null;
            for (var i in lines) {
                curLine = i;
                if (previousLine !== null) {
                    line1 = lines[previousLine];
                    line2 = lines[curLine];
                    mergedText = merge(line1, line2);
                    if (mergedText !== false) {
                        lines[curLine] = mergedText;
                        delete lines[previousLine];
                    }
                }
                previousLine = curLine;
            }
            obj.lines = lines;
            obj.reducing = reducing;
        }
        if (typeof input != "string")
            throw "Inappropriate input type for format.";
        var workingObject = {
            lines: input.split("\n"),
            loopCount: 0,
            reducing: false
        };
        do {
            workingObject.reducing = false;
            combineListItems(workingObject);
            console.log(workingObject.lines);
        } while (workingObject.reducing == true && workingObject.loopCount++ < 100000);
        var standardData = StandardObjectBuilder.parseArray(workingObject.lines);
        return standardData;
    }

    MarkdownTextFormat.prototype.format = function (stdObj, options) {
        function fixPunctuation( text, previousLines )
        {
            var punctuationCorrection = /\s(\.|!|\?)/;
            while( punctuationCorrection.test(text) )
            {
                var match = punctuationCorrection.exec( text );
                text = text.replace(match[0], match[1]);
                if( text.indexOf( match[1] ) == 0 && previousLines.length > 0){
                    previousLines[ previousLines.length - 1 ] += match[1];
                    text = text.substr(1);
                }
            }
            return text;
        }
        /**
         * Break a text into multiple lines no longer than the specified length
         * 
         * @param {String} text
         * @param {int} length
         * @returns {String[*]}
         */
        function chunk(text, length) {
            var tokens = text.split(" ");
            var line = "";
            var formatted = [];
            for (var i in tokens) {
                if (tokens[i]=="") continue;
                if (line.length + 1 + tokens[i].length >= length)
                {
                    line = fixPunctuation( line, formatted );
                    formatted.push(line);
                    line = "";
                }
                if (line.length > 0)
                    line += " ";
                line += tokens[i];
            }
            
            if (line.length > 0) {
                line = fixPunctuation(line, formatted);
                formatted.push(line);
            }
            return formatted;
        }

        /**
         * This private version of format takes a StandardObject in and returns a string.
         * @param {StandardObject} item
         * @returns {String}
         */
        function format(item, options) {
            var line = "";
            var text = null;
            var size = 75;
            var indent = "    ";
            if (item instanceof Header)
            {
                for (var i = 0; i < item.headerLevel; i++)
                {
                    line += "#";
                }
                //the header is always a leaf node
                line += " " + item.text + "\n" + "\n";
            } else if (item instanceof TextNode)
            {
                var safety = 0;
                text = item.text;
                while( text !== text.replace("\n","") && safety++ < 10 ){
                    text = item.text.replace("\n","");
                }
                while( text !== text.replace(/\b\s\s+\b/," ") ){
                    text = text.replace(/\b\s\s+\b/," ");
                }
                line = text;
            } else if (item instanceof ListItem)
            {
                var symbol = null;
                switch (item.listType) {
                    case "ol":
                        symbol = "1. ";
                        break;
                    case "ul":
                    default:
                        symbol = "- ";
                        break;
                }
                var internalContent = this.__proto__.format.call(this, item.containedBlocks);
                internalContent = internalContent.split("\n");
                while (internalContent[ internalContent.length - 1] == "") {
                    internalContent.pop();
                }
                var firstLine = internalContent[0];
                var addLine = internalContent.slice(1);
                line = symbol + firstLine + "\n";
                for (var i = 0; i < addLine.length; i++)
                {
                    line += indent + addLine[i] + "\n";
                }
            } else if (item instanceof Blockquote)
            {
                var symbol = "> ";
                var internalContent = this.__proto__.format.call(this, item.containedBlocks);
                internalContent = internalContent.split("\n");
                while (internalContent[ internalContent.length - 1] == "") {
                    internalContent.pop();
                }
                for (var i = 0; i < internalContent.length; i++)
                {
                    line += symbol + internalContent[i] + "\n";
                }
            } else if (item instanceof Paragraph)
            {
                var internalContent = this.__proto__.format.call(this, item.containedBlocks, {spacer:" "});
                internalContent = chunk.call(this, internalContent, size);
                internalContent = internalContent.join("\n");
                line += internalContent + "\n\n";
            } else if (item instanceof LineBreak)
            {
                line = "\\\n";
            }
            else if (item instanceof StrongText)
            {
                var token = "_";
                if( options.curEmphasis && options.curEmphasis == "_" ){
                    token = "*";
                }
                var text = this.__proto__.format.call(this, item.containedBlocks, {curEmphasis:token});
                line = token + token + text + token + token;
            }
            else if (item instanceof EmphasizedText)
            {
                var token = "_";
                if( options.curEmphasis && options.curEmphasis == "_" ){
                    token = "*";
                }
                var text = this.__proto__.format.call(this, item.containedBlocks, {curEmphasis:token});
                line = token + text + token;
            }
            else if (item instanceof DeletedText)
            {
                var text = this.__proto__.format.call(this, item.containedBlocks);
                line = "~~" + text + "~~";
            }
            return line;
        }
        var markdownString = "";
        var stdObjItem;
        var defaultOptions = {
            newLineString: "",
            spacer: "",
            curEmphasis: ""
        };
        for (var i in options) {
            defaultOptions[i] = options[i];
        }
        for (var i in stdObj) {
            stdObjItem = stdObj[i];
            if( markdownString.length > 0 && defaultOptions.spacer ) markdownString += defaultOptions.spacer;
            markdownString += format.call(this, stdObjItem, defaultOptions);
        }
        return markdownString;
    }

    function StandardObject() {
        this.text = "";
        this.containedBlocks = [];
    }
    StandardObject.prototype.setText = function (text) {
        if (this.text !== "") {
            throw "Standard Objects are immutable.";
        }
        this.text = text;
    };
    StandardObject.prototype.addContent = function (object) {
        if (!(object instanceof StandardObject)) {
            throw "Unable to add content that is of a different type than StandardObject.";
        }
        this.containedBlocks.push(object);
    }
    function TextNode(text) {
        //we call the constructor passing "this" otherwise the variables are shared 
        //between objects
        this.__proto__.constructor.call(this);
        this.setText(text);
    }
    TextNode.prototype = Object.create(StandardObject.prototype);
    TextNode.constructor = TextNode;

    function Paragraph() {
        //we call the constructor passing "this" otherwise the variables are shared 
        //between objects
        this.__proto__.constructor.call(this);
    }
    Paragraph.prototype = Object.create(StandardObject.prototype);
    Paragraph.constructor = Paragraph;
    Paragraph.prototype.setText = function (text) {
        throw "Paragraphs may contain only TextNodes and LineBreaks";
    };
    Paragraph.prototype.addContent = function (element) {
        if (element instanceof TextNode || element instanceof LineBreak || element instanceof StrongText || element instanceof EmphasizedText || element instanceof DeletedText ) {
            StandardObject.prototype.addContent.call(this, element);
        } else {
            throw "Paragraphs may contain only TextNodes and LineBreaks";
        }
    };

    function LineBreak() {
        //we call the constructor passing "this" otherwise the variables are shared 
        //between objects
        this.__proto__.constructor.call(this);
    }
    LineBreak.prototype = Object.create(StandardObject.prototype);
    LineBreak.constructor = LineBreak;
    LineBreak.prototype.setText = function (text) {
        throw "LineBreaks cannot contain text.";
    };
    LineBreak.prototype.addContent = function (object) {
        throw "LineBreaks cannot contain other elements.";
    };

    function Header(level, text) {
        //we call the constructor passing "this" otherwise the variables are shared 
        //between objects
        this.__proto__.constructor.call(this);
        this.headerLevel = level;
        this.setText(text);
    }
    Header.prototype = Object.create(StandardObject.prototype);
    Header.construtor = Header;

    function Blockquote() {
        //we call the constructor passing "this" otherwise the variables are shared 
        //between objects
        this.__proto__.constructor.call(this);
    }
    Blockquote.prototype = Object.create(StandardObject.prototype);
    Blockquote.constructor = Blockquote;
    Blockquote.prototype.setText = function () {
        throw "Unable to set text on Blockquote";
    }

    function ListItem(tagName) {
        //we call the constructor passing "this" otherwise the variables are shared 
        //between objects
        this.__proto__.constructor.call(this);
        this.listType = tagName;
    }
    ListItem.prototype = Object.create(StandardObject.prototype);
    ListItem.constructor = ListItem;
    ListItem.prototype.setText = function () {
        throw "Unable to set text on ListItem";
    }

    function StrongText()
    {
        this.__proto__.constructor.call(this);
    }
    StrongText.prototype = Object.create(StandardObject.prototype);
    StrongText.constructor = StrongText;

    function EmphasizedText()
    {
        this.__proto__.constructor.call(this);
    }
    EmphasizedText.prototype = Object.create(StandardObject.prototype);
    EmphasizedText.constructor = EmphasizedText;

    function DeletedText()
    {
        this.__proto__.constructor.call(this);
    }
    DeletedText.prototype = Object.create(StandardObject.prototype);
    DeletedText.constructor = DeletedText;

    function StandardObjectBuilder() {
        this.HEADER = "header";
        this.BLOCKQUOTE = "blockquote";
        this.LI = "li";
        this.PARAGRAPH = "p";
        this.clear();
    }
    /**
     * Convert array of text into an array of standard objects.
     * 
     * This method is recursive. It analyses a single "level" of text and pushes all 
     * iterative levels onto a stack for future analyses on a future pass.
     * 
     * All text is converted to StandardObjects before returning an array.
     * 
     * @param {String[*]} lines
     * @returns {StandardObject[*]}
     */
    StandardObjectBuilder.parseArray = function (lines, parseType) {
        parseType = (typeof parseType == "undefined" ? "block" : "inline");
        switch (parseType)
        {
            case "block":
                return StandardObjectBuilder.parseBlockLevelArray(lines);
                break;
            case "inline":
                return StandardObjectBuilder.parseInlineLevelArray(lines);
                break;
        }
    }
    StandardObjectBuilder.parseInlineLevelArray = function (lines)
    {
        function findSubNodes( text, map ){
            var tests = 
            {
                strong: /(__|\*\*)(.+?)\1/,
                em: /(_|\*)(.+?)\1/,
                del: /(~~)(.+?)\1/
            };
            var parts = [];
            var successes = {};
            var shortest = null;
            for( var i in tests ){
                if( tests[i].test( text ) ){
                    successes[i] = tests[i].exec( text );
                    if( shortest == null )
                    {
                        shortest = i;
                    }
                    else
                    {
                        var short = successes[shortest];
                        var cur = successes[i];
                        if( cur[2].length < short[2].length ){
                            shortest = i;
                        }
                    }
                }
            }
            if( shortest !== null ){
                var obj         = null;
                var mapIndex    = "@@MAPPED" + map.index++ + "@@";
                var mappedObj   = successes[ shortest ];
                mappedObj["type"] = shortest;

                var adjustedText = text.replace( successes[shortest][0], mapIndex );
                map[ mapIndex ] = mappedObj;
                parts =  findSubNodes.call( this, adjustedText, map );
            }
            else
            {
                var safety = 0;
                do
                {
                    var changeMade = false;
                    parts = text.split("@@");
                    for( var index in parts ){
                        var mapId = "@@" + parts[index] + "@@";
                        if( typeof map[ mapId ] == "undefined" ){
                            var node = new TextNode(parts[index]);
                            parts[ index ] = node;
                        }else{
                            var node = null;
                            switch( map[ mapId ]["type"] ){
                                case "strong":
                                    node = new StrongText();
                                    break;
                                case "em":
                                    node = new EmphasizedText();
                                    break;
                                case "del":
                                    node = new DeletedText();
                                    break;    
                            }
                            var subUnits = findSubNodes.call( this, map[ mapId ][2], map );
                            for( var i in subUnits ){
                                node.addContent( subUnits[i] );
                            }
                            parts[index] = node;
                        }
                    }
                }while( changeMade && safety++ < 100 );
            }
            return parts;
        }
        var text = null;
        var node = [];
        for (var i = 0; i < lines.length; i++)
        {
            text = lines[i];
            if (text == "\n")
            {
                node.push(new LineBreak());
            } 
            else
            {
                var sub = findSubNodes.call( this, text, { index: 0 } );
                if( sub.length > 0 ){
                    for( var j = 0; j < sub.length; j++ ){
                        node.push( sub[j] );
                    }
                }else{
                    node.push(new TextNode(text.trim()));
                }
            }
        }
        return node;
    }
    StandardObjectBuilder.parseBlockLevelArray = function (lines) {
        var standardizedLines = [];
        var builder = new StandardObjectBuilder();

        var header = /^#+\s{1}/;
        var blockquote = /^>\s{1}/;
        var olli = /^\d+\.?/;
        var ulli = /^(?:-|\*)/;
        var indented = /^\s{4}/;
        /* 
         * line breaks are parsed as inline level elements
         * Unline other elements, the line break is the only one that 
         * needs accounting in the Block level first.
         */
        var lineBreak = /(\\\n)|(\\)$/;
        var continueParagraph = false;
        for (var i in lines) {
            var line = lines[i];
            if (line == "") {
                if (builder.hasItem()) {
                    standardizedLines.push(builder.getObject());
                    builder.clear();
                    continueParagraph = false;
                }
                continue;
            }
            var safety = 0;
            do {
                var repeat = false;
                var notTextNode = false;
                try {
                    if (indented.test(line)) {
                        builder.addContent(line);
                    } else if (olli.test(line)) {
                        notTextNode = true;
                        builder.setType(builder.LI);
                        builder.setListTag("ol");
                        builder.addContent(line.replace(/^\d+\.?\s+/, ""));
                    } else if (ulli.test(line)) {
                        notTextNode = true;
                        builder.setType(builder.LI);
                        builder.setListTag("ul");
                        builder.addContent(line.replace(/^(-|\*)\s+/, ""));
                    } else if (header.test(line)) {
                        notTextNode = true;
                        var level = 0;
                        var text = line;
                        do {
                            level++;
                            text = text.replace(/^#\s?/, "");
                        } while (header.test(text));
                        builder.makeHeader(builder.HEADER, level, text);
                    } else if (blockquote.test(line)) {
                        notTextNode = true;
                        if (builder.type !== builder.BLOCKQUOTE)
                            builder.setType(builder.BLOCKQUOTE);
                        builder.addContent(line);
                    } else if (!notTextNode == true) {
                        if (continueParagraph === false)
                            builder.setType(builder.PARAGRAPH);
                        builder.addContent(line.replace(lineBreak, "").trim());
                        if (lineBreak.test(line))
                        {
                            continueParagraph = true;
                            builder.addContent("\n");
                        } else
                        {
                            continueParagraph = false;
                        }
                    }
                } catch (e) {
                    standardizedLines.push(builder.getObject());
                    builder.clear();
                    repeat = true;
                }
            } while (repeat == true && safety++ < 1000);
        }
        if (builder.hasItem()) {
            standardizedLines.push(builder.getObject());
            builder.clear();
            continueParagraph = false;
        }
        return standardizedLines;
    }
    StandardObjectBuilder.prototype.getObject = function () {
        if (this.content.length > 0) {
            //blockquotes, list items, and paragraphs all have sub content
            if (this.BLOCKQUOTE == this.type) {
                var lines = StandardObjectBuilder.parseArray(this.content);
                var block = new Blockquote();
                for (var i in lines) {
                    block.addContent(lines[i]);
                }
                return block;
            } else if (this.LI == this.type) {
                var lines = StandardObjectBuilder.parseArray(this.content);
                var list = new ListItem(this.listItemTag);
                for (var i in lines) {
                    list.addContent(lines[i]);
                }
                return list;
            } else if (this.PARAGRAPH == this.type) {
                //paragraphs may not include list items or block quotes, or headers, 
                //so we join these items into a text block
                var p = new Paragraph();
                var subContent = StandardObjectBuilder.parseArray(this.content, "inline");
                for (var i = 0; i < subContent.length; i++)
                {
                    p.addContent(subContent[i]);
                }
                return p;
            } else {
                //unknown case. See what stops here.
                debugger;
            }

        } else {
            if (this.type == this.HEADER) {
                return new Header(this.headerLevel, this.text);
            } else {
                //unknown case. Look to see what stops here.
                debugger;
            }
        }
    }
    StandardObjectBuilder.prototype.hasItem = function () {
        return !this.empty;
    }
    StandardObjectBuilder.prototype.setListTag = function (tagName) {
        this.listItemTag = tagName;
    }
    StandardObjectBuilder.prototype.clear = function () {
        this.empty = true;
        this.type = null;
        this.indent = 0;
        this.headerLevel = 0;
        this.text = "";
        this.listItemTag = "";
        this.canHaveSubContent = true;
        this.content = [];
    }
    StandardObjectBuilder.prototype.setType = function (type) {
        if (this.type !== null)
            throw "Builder Type already set to " + this.type;
        this.type = type;
    }
    StandardObjectBuilder.prototype.makeHeader = function (type, level, text) {
        this.setType(this.HEADER);
        this.headerLevel = level;
        this.text = text;
        this.canHaveSubContent = false;
        this.empty = false;
    }
    StandardObjectBuilder.prototype.addContent = function (line) {
        switch (this.type) {
            case this.HEADER:
                throw "Content not permitted in Headers.";
                break;
            case this.BLOCKQUOTE:
                var regex = /^>\s?/;
                if (!regex.test(line)) {
                    throw "Content is not a blockquote item.";
                }
                line = line.replace(regex, "");
                break;
            case this.LI:
                //list items can 
                var indent = /^\s{4}/;
                if (this.content.length > 1 && !indent.test(line)) {
                    throw "ListItem content must be indented by one line.";
                }
                line = line.replace(indent, "");
                break;
        }
        this.content.push(line);
        this.empty = false;
        if (this.type == null) {
            this.type = this.PARAGRAPH;
        }
    }

    function Html5Format() {}
    Html5Format.prototype = Object.create(Formatter.prototype);
    Html5Format.constructor = Html5Format();

    Html5Format.prototype.standardize = function (input, options) {
        /**
         * Convert a single domElement into a single StandardObject that represents
         * the domElement (recursive)
         * 
         * @param {Element} domElement
         * @returns {StandardObject[0..*]} 
         */
        function convert(domElement, options) {
            var headerTag = /^H(\d+)/;
            var tagName = domElement.tagName;
            if (domElement instanceof Text) {
                if (domElement.textContent.trim() == "") {
                    return null;
                } else {
                    return [new TextNode(domElement.textContent)];
                }
            } else if (headerTag.test(tagName)) {
                var match = tagName.match(headerTag);
                var level = match[1];
                var text = domElement.textContent;
                return [new Header(level, text)];
            } else if (tagName == "P")
            {
                var p = new Paragraph();
                var array = StandardizationFunction.call(this, domElement, {});
                for (var i in array) {
                    p.addContent(array[i]);
                }
                return [p];
            } else if (tagName == "OL" || tagName == "UL")
            {
                var options = {listType: tagName.toLowerCase()};
                var arrayData = StandardizationFunction.call(this, domElement, options);
                return arrayData;
            } else if (tagName == "LI")
            {
                var listItem = new ListItem(options.listType);
                /**
                 * We must now determine if the list item contains recusive content
                 * or just text.
                 */
                if (domElement.childNodes.length == 1 && domElement.childNodes[0] instanceof Text)
                {
                    //case: <li> contains only text
                    var text = domElement.textContent;
                    listItem.addContent(new TextNode(text));
                } else {
                    //we do not pass the options forward. The <li> is a barrire between scopes
                    var array = StandardizationFunction.call(this, domElement, {});
                    for (var i in array) {
                        listItem.addContent(array[i]);
                    }
                }
                return [listItem];
            } else if (tagName == "BLOCKQUOTE")
            {
                var blockquote = new Blockquote();
                /**
                 * We must now determine if the list item contains recusive content
                 * or just text.
                 */
                if (domElement.childNodes.length == 1 && domElement.childNodes[0] instanceof Text)
                {
                    //case: <blockquote> contains only text
                    var text = domElement.textContent;
                    blockquote.addContent(new TextNode(text));
                } else {
                    //we do not pass the options forward. The <blockquote> is a barrire between scopes
                    var array = StandardizationFunction.call(this, domElement, {});
                    for (var i in array) {
                        blockquote.addContent(array[i]);
                    }
                }
                return [blockquote];
            } 
            else if (tagName == "BR")
            {
                //at the moment line breaks are not handled.
                return [new LineBreak()];
            } 
            else if (tagName == "DIV")
            {
                return StandardizationFunction.call(this, domElement, {});
            } 
            else if (tagName == "B" || tagName == "STRONG")
            {
                var strongElement = new StrongText();
                var content = StandardizationFunction.call(this, domElement, {} );
                for( var i in content ){
                    strongElement.addContent( content[i] );
                }
                return [strongElement];
            }
            else if (tagName == "I" || tagName == "EM" )
            {
                var emphasizedElement = new EmphasizedText();
                var content = StandardizationFunction.call(this, domElement, {} );
                for( var i in content ){
                    emphasizedElement.addContent( content[i] );
                }
                return [emphasizedElement];
            }
            else if (tagName == "DEL")
            {
                var deletedElement = new DeletedText();
                var content = StandardizationFunction.call(this, domElement, {} );
                for( var i in content ){
                    deletedElement.addContent( content[i] );
                }
                return [deletedElement];
            }
            else
            {
                debugger;
            }
        }
        var defaultOptions = {
            listType: null
        };
        options = (typeof options == "undefined" ? {} : options);
        for (var i in options)
        {
            defaultOptions[i] = options[i];
        }
        var dom = {};
        if (input instanceof Element) {
            //the HTML Dom element was probably passed in.
            dom = input;
        } else if (typeof input == "string") {
            var parser = new DOMParser();
            var dom = parser.parseFromString(input, "application/xml");
            //check dom for an "error document"
            if (dom.getElementsByTagName("parsererror").length > 0) {
                throw "This string is poorly formatted html";
                /**
                 * We originally thought about "digging deeper" here to see if 
                 * adding a root tag would fix the formatting mistakes, but that 
                 * would convert Markdown to valid HTML, so we no longer dig deeper.
                 * 
                 * Make sure that you send a valid HTML item with a single root.
                 */
            }
        } else {
            throw "Unknown input type.";
        }
        var html5Formatter = this;
        var StandardizationFunction = this.__proto__.standardize;
        /**
         * At this point in the code, the input has been converted to a Document object
         * Convert each element of the document into the StandardObject that would have 
         * created that element.
         */
        var standardObjectArray = [], sObjRepresentationArray = null;
        for (var i = 0; i < dom.childNodes.length; i++) {
            sObjRepresentationArray = convert.call(this, dom.childNodes[i], defaultOptions);
            if (sObjRepresentationArray !== null)
            {
                for (var n = 0; n < sObjRepresentationArray.length; n++) {
                    standardObjectArray.push(sObjRepresentationArray[n]);
                }
            }
        }

        return standardObjectArray;
    };

    Html5Format.prototype.format = function (standardArray, tag, forceTag) {
        function formatHeader(stdObj, returnObj) {
            returnObj.string = "<h" + stdObj.headerLevel + ">" + stdObj.text + "</h" + stdObj.headerLevel + ">";
            returnObj.last = stdObj;
        }
        function formatStrong(stdObj, returnObj)
        {
            returnObj.string = html5Formatter.format(stdObj.containedBlocks, "strong", true);
            returnObj.last = stdObj;
        }
        function formatEmphasized(stdObj, returnObj)
        {
            returnObj.string = html5Formatter.format(stdObj.containedBlocks, "em", true);
            returnObj.last = stdObj;
        }
        function formatDeleted(stdObj, returnObj)
        {
            returnObj.string = html5Formatter.format(stdObj.containedBlocks, "del", true);
            returnObj.last = stdObj;
        }
        function formatParagraph(stdObj, returnObj) {
            returnObj.string = html5Formatter.format(stdObj.containedBlocks, "p", true);
            returnObj.last = stdObj;
        }
        function formatTextNode(stdObj, returnObj) {
            returnObj.string = stdObj.text;
            returnObj.last = stdObj;
        }
        function formatLineBreak(stdObj, returnObj) {
            returnObj.string = "<br/>";
            returnObj.last = stdObj;
        }
        function formatListItem(stdObj, returnObj) {
            var listItemString = "";
            if (!(returnObj.last instanceof ListItem) || returnObj.last.listType !== stdObj.listType) {
                listItemString = "<" + stdObj.listType + ">";
            }
            if (stdObj.containedBlocks.length == 1 )
            {
                var text = "";
                if( stdObj.containedBlocks[0] instanceof TextNode) 
                {
                    text = stdObj.containedBlocks[0].text;
                }
                else if( stdObj.containedBlocks[0] instanceof Paragraph )
                {
                    text = html5Formatter.format( stdObj.containedBlocks[0].containedBlocks, "", false );
                }
                listItemString += "<li>" + text + "</li>";
            } else {
                var html = html5Formatter.format(stdObj.containedBlocks, "li", true);
                listItemString += html;
            }
            returnObj.string = listItemString;
            returnObj.last = stdObj;
        }
        function formatBlockquote(stdObj, returnObj) {
            returnObj.string = html5Formatter.format(stdObj.containedBlocks, "blockquote", true);
            returnObj.last = stdObj;
        }
        function closeGrouping(stdObj, returnObj) {
            if (returnObj.last instanceof ListItem
                    &&
                    (
                            !(stdObj instanceof ListItem)
                            || stdObj.listType !== returnObj.last.listType
                            )
                    ) {
                returnObj.string = "</" + returnObj.last.listType + ">";
            } else {
                returnObj.string = "";
            }
        }
        function formatStandardObject(stdObj, returnObj) {
            closeGrouping(stdObj, returnObj);
            var closingTag = returnObj.string;
            if (stdObj instanceof Header) {
                formatHeader(stdObj, returnObj);
            } else if (stdObj instanceof TextNode) {
                formatTextNode(stdObj, returnObj);
            } else if (stdObj instanceof LineBreak) {
                formatLineBreak(stdObj, returnObj);
            } else if (stdObj instanceof Paragraph) {
                formatParagraph(stdObj, returnObj);
            } else if (stdObj instanceof ListItem) {
                formatListItem(stdObj, returnObj);
            } else if (stdObj instanceof Blockquote) {
                formatBlockquote(stdObj, returnObj);
            } else if (stdObj instanceof StrongText)
            {
                formatStrong(stdObj, returnObj);
            }
            else if(stdObj instanceof EmphasizedText)
            {
                formatEmphasized(stdObj, returnObj);
            }
            else if(stdObj instanceof DeletedText)
            {
                formatDeleted(stdObj, returnObj);
            }
            returnObj.string = closingTag + returnObj.string;
        }
        tag = (typeof tag == "undefined" ? "div" : tag);
        var sObj = null;
        var html5Formatter = this;
        var htmlString = "", tempObj = {last: null, string: null};
        var lastElementTagIdentifier = "";
        for (var i in standardArray) {
            sObj = standardArray[i];
            formatStandardObject(sObj, tempObj);
            htmlString += tempObj.string;
        }
        closeGrouping(null, tempObj);
        htmlString += tempObj.string;
        if (standardArray.length > 1 || forceTag === true ) {
            htmlString = "<" + tag + ">" + htmlString + "</" + tag + ">";
        }
        return htmlString;
    };

    /**
     * Generic interface to convert a standard structure into a variety of output
     * formats.
     * 
     * @param {standardized data structure} dataStruct
     * @param {formatter} outputFormatter
     * @returns {string}
     */
    var Format = function (dataStruct, outputFormatter) {
        return outputFormatter.format(dataStruct);
    };

    return {
        MARKDOWN: "md",
        HTML5: "html5",
        /**
         * Takes an input string in an unknown format, and outputs it as a string in the 
         * specified format.
         * 
         * @param {string} input
         * @param {string} outputFormatId
         * @returns {string}
         */
        read: function (input, outputFormatId) {
            var standardizedStructure = MarkdownReader(input);
            var helper = null;
            switch (outputFormatId) {
                case this.MARKDOWN:
                    helper = new MarkdownTextFormat();
                    break;
                case this.HTML5:
                    helper = new Html5Format();
                    break;
            }
            return Format(standardizedStructure, helper);
        }
    };
}();

