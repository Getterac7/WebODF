/**
 * Copyright (C) 2012 KO GmbH <copyright@kogmbh.com>
 *
 * @licstart
 * The JavaScript code in this page is free software: you can redistribute it
 * and/or modify it under the terms of the GNU Affero General Public License
 * (GNU AGPL) as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.  The code is distributed
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU AGPL for more details.
 *
 * As additional permission under GNU AGPL version 3 section 7, you
 * may distribute non-source (e.g., minimized or compacted) forms of
 * that code without the copy of the GNU GPL normally required by
 * section 4, provided you include this license notice and a URL
 * through which recipients can access the Corresponding Source.
 *
 * As a special exception to the AGPL, any HTML file which merely makes function
 * calls to this code, and for that purpose includes it by reference shall be
 * deemed a separate work for copyright law purposes. In addition, the copyright
 * holders of this code give you permission to combine this code with free
 * software libraries that are released under the GNU LGPL. You may copy and
 * distribute such a system following the terms of the GNU AGPL for this code
 * and the LGPL for the libraries. If you modify this code, you may extend this
 * exception to your version of the code, but you are not obligated to do so.
 * If you do not wish to do so, delete this exception statement from your
 * version.
 *
 * This license applies to this entire compilation.
 * @licend
 * @source: http://www.webodf.org/
 * @source: http://gitorious.org/webodf/webodf/
 */
/*global define, require */
define("webodf/editor/widgets/toolbarWidgets/currentStyle",
       ["webodf/editor/EditorSession"],

  function (EditorSession) {
    "use strict";
    function makeWidget(editorSession, callback) {
        require(["webodf/editor/widgets/paragraphStyles"], function (ParagraphStyles) {
            var paragraphStyles, widget;

            paragraphStyles = new ParagraphStyles(editorSession, function (pStyles) {
                // if the current paragraph style changes, update the widget 
                editorSession.subscribe(EditorSession.signalParagraphChanged, function (info) {
                    if (info.type === 'style') {
                        pStyles.widget().set("value", info.styleName);
                    }
                });
                
                pStyles.widget().onChange = function (value) {
                    editorSession.setCurrentParagraphStyle(value);
                };

                return callback(pStyles.widget());
            });
        });
    }

    return function CurrentStyle(editorSession, callback) {
        makeWidget(editorSession, function (widget) {
            return callback(widget);
        });
    };
});
