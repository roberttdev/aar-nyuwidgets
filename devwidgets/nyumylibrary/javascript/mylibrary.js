/*
 * Licensed to the Sakai Foundation (SF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The SF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * specific language governing permissions and limitations under the License.
 */

// load the master sakai object to access all Sakai OAE API methods
require(["jquery", "sakai/sakai.api.core"], function($, sakai) {

    /**
     * @name sakai_global.mylibrary
     *
     * @class mylibrary
     *
     * @description
     * Widget that lists all of the content items that live inside of a given
     * library
     *
     * @param {String} tuid Unique id of the widget
     * @param {Boolean} showSettings Show the settings of the widget or not
     */
    sakai_global.nyumylibrary = function (tuid, showSettings, widgetData, state) {

        /////////////////////////////
        // Configuration variables //
        /////////////////////////////

        var mylibrary = {  // global data for mylibrary widget
            sortBy: "_lastModified",
            sortOrder: "desc",
            isOwnerViewing: false,
            default_search_text: "",
            userArray: [],
            contextId: false,
            infinityScroll: false,
            widgetShown: true,
            listStyle: "list"
        };                

        // DOM jQuery Objects
        var $rootel = $("#" + tuid);  // unique container for each widget instance
        var $mylibrary_check = $(".mylibrary_check", $rootel);
        var $mylibrary_items = $("#mylibrary_items", $rootel);
        var $mylibrary_check_all = $("#mylibrary_select_checkbox", $rootel);
        var $mylibrary_remove = $("#mylibrary_remove", $rootel);
        var $mylibrary_addto = $("#mylibrary_addpeople_button", $rootel);
        var $mylibrary_share = $("#mylibrary_content_share", $rootel);
        var $mylibrary_sortby = $("#mylibrary_sortby", $rootel);
        var $mylibrary_livefilter = $("#mylibrary_livefilter", $rootel);
        var $mylibrary_livefilter_container = $("#mylibrary_livefilter_container", $rootel);
        var $mylibrary_sortarea = $("#mylibrary_sortarea", $rootel);
        var $mylibrary_empty = $("#mylibrary_empty", $rootel);
        var $mylibrary_admin_actions = $("#mylibrary_admin_actions", $rootel);
        var $mylibrary_addcontent = $("#mylibrary_addcontent", $rootel);
        var $mylibrary_remove_icon = $(".mylibrary_remove_icon", $rootel);
        var $mylibrary_search_button = $("#mylibrary_search_button", $rootel);
        var $mylibrary_show_grid = $(".s3d-listview-grid", $rootel);
        var $mylibrary_show_list = $(".s3d-page-header-top-row .s3d-listview-list", $rootel);
        var $mylibraryAddContentOverlay = $(".sakai_add_content_overlay", $rootel);

        var currentGroup = false;

        // Tag cloud related variables
        var tagArray = [];
        var activeTags = [];
	var refineTags = [];	
        var MAX_TAGS_IN_CLOUD = 20;
        var MAX_TAGS_IN_FILTER = 10;
        var showTagCloud = false; 
        if (widgetData && widgetData.nyumylibrary && widgetData.nyumylibrary.hasOwnProperty("showTagCloud")) {
            showTagCloud = widgetData.nyumylibrary.showTagCloud === "true";
        }

        ///////////////////////
        // Utility functions //
        ///////////////////////

        /**
         * Get personalized text for the given message bundle key based on
         * whether this library is owned by the viewer, or belongs to someone else.
         * The message should contain a '${firstname}' variable to replace with
         * and be located in this widget's properties files.
         *
         * @param {String} bundleKey The message bundle key
         */
        var getPersonalizedText = function (bundleKey) {
            if(currentGroup){
                return sakai.api.i18n.getValueForKey(
                    bundleKey, "nyumylibrary").replace(/\$\{firstname\}/gi,
                        currentGroup.properties["sakai:group-title"]);
            } else if (mylibrary.isOwnerViewing) {
                return sakai.api.i18n.getValueForKey(
                    bundleKey, "nyumylibrary").replace(/\$\{firstname\}/gi,
                        sakai.api.i18n.getValueForKey("YOUR").toLowerCase());
            } else {
                return sakai.api.i18n.getValueForKey(bundleKey, "nyumylibrary").replace(/\$\{firstname\}/gi, sakai.api.User.getFirstName(sakai_global.profile.main.data) + "'s");
            }
        };

        /**
         * Bring all of the topbar items (search, checkbox, etc.) back into its original state
         */
        var resetView = function(){
            $mylibrary_check_all.removeAttr("checked");
            $mylibrary_remove.attr("disabled", "disabled");
            $mylibrary_addto.attr("disabled", "disabled");
            $mylibrary_share.attr("disabled", "disabled");
            $("#mylibrary_title_bar").show();
        };

        /**
         * Show or hide the controls on the top of the library (search box, sort, etc.)
         * @param {Object} show    True when you want to show the controls, false when
         *                         you want to hide the controls
         */
        var showHideTopControls = function(show){
            if (show){
                if (mylibrary.isOwnerViewing) {
                    $mylibrary_remove.show();
                    $mylibrary_admin_actions.show();
                    $mylibraryAddContentOverlay.show();
                }
                $mylibrary_livefilter_container.show();
                $mylibrary_sortarea.show();
            } else {
                $mylibrary_admin_actions.hide();
                $mylibrary_livefilter_container.hide();
                $mylibrary_sortarea.hide();
            }
        };

        /////////////////////////////
        // Deal with empty library //
        /////////////////////////////

        /**
         * Function that manages how a library with no content items is handled. In this case,
         * the items container will be hidden and a "no items" container will be shown depending
         * on what the current context of the library is
         */
        var handleEmptyLibrary = function(){
            resetView();
            $mylibrary_items.hide();
            var query = $mylibrary_livefilter.val();
            // We only show the controls when there is a search query. 
            // All other scenarios with no items don't show the top controls
            if (!query){
                showHideTopControls(false);
                $(".s3d-page-header-top-row").hide();
                $(".s3d-page-header-bottom-row").hide();
            } else {
                showHideTopControls(true);
                $(".s3d-page-header-top-row").show();
                $(".s3d-page-header-bottom-row").show();
            }
            // Determine the state of the current user in the current library
            var mode = "user_me";
            if (sakai_global.profile && mylibrary.contextId !== sakai.data.me.user.userid) {
                mode = "user_other";
            } else if (!sakai_global.profile && mylibrary.isOwnerViewing) {
                mode = "group_managed";
            } else if (!sakai_global.profile) {
                mode = "group";
            }
            $mylibrary_empty.html(sakai.api.Util.TemplateRenderer("mylibrary_empty_template", {
                mode: mode,
                query: query
            }));
            
            $mylibrary_empty.show();
        }

        ////////////////////
        // Load a library //
        ////////////////////

        /**
         * Load the items of the current library and start an infinite scroll on
         * them
         */
        var showLibraryContent = function () {
            resetView();
            var query = $mylibrary_livefilter.val() || "*";
            // Disable the previous infinite scroll
            if (mylibrary.infinityScroll){
                mylibrary.infinityScroll.kill();
            }
            // Set up the infinite scroll for the list of items in the library
            var sortOrder = mylibrary.sortOrder;
            if (mylibrary.sortOrder === "modified"){
                sortOrder = "desc";
            }
           
            // append any tag filters
            if (activeTags.length > 0) {
                if (query.length > 0) {
                    query += " AND ";
                }
                query += activeTags.join(" AND ");
            }
            
            mylibrary.infinityScroll = $mylibrary_items.infinitescroll(
                "/var/search/pool/manager-viewer.json", 
                {                
                    userid: mylibrary.contextId,
                    sortOn: mylibrary.sortBy,
                    sortOrder: sortOrder,
                    q: query
                }, 
                function(items, total){
                    if(!sakai.data.me.user.anon){
                        if(items.length !== 0){
                            $(".s3d-page-header-top-row").show();
                            $(".s3d-page-header-bottom-row").show();
                        }
                    } else {
                        if(items.length !== 0){
                            $(".s3d-page-header-top-row").show();
                        }
                    }
                    return sakai.api.Util.TemplateRenderer("mylibrary_items_template", {
                        "items": items,
                        "sakai": sakai,
                        "isMe": mylibrary.isOwnerViewing
                    });
                }, 
                handleEmptyLibrary, 
                sakai.config.URL.INFINITE_LOADING_ICON, 
                handleLibraryItems, 
                function() {
                    // Initialize content draggable
                    sakai.api.Util.Draggable.setupDraggable({}, $mylibrary_items);
                }, 
                sakai.api.Content.getNewList(mylibrary.contextId),
                function(data) {
                    refineTags = [];
                    if (data.hasOwnProperty("facet_fields") && data.facet_fields.length && data.facet_fields[0].hasOwnProperty("tagname") && data.facet_fields[0].tagname.length) {                        
			tagArray = [];
                        // put the tags from the tag cloud service into an array
                        for (var i=0; i<data.facet_fields[0].tagname.length; i++) {
                           var tag =  sakai.api.Util.formatTags( $.map(data.facet_fields[0].tagname[i], function(v,k) {return k;})[ 0 ] )[ 0 ];
                           tag.count = data.facet_fields[0].tagname[i][tag["original"]];
                            if (tag.count > 0) {
                                tagArray.push( tag );
                            }                           
                        };
                        tagArray.sort(function(a, b){
                            var nameA = a.value.toLowerCase();
                            var nameB = b.value.toLowerCase();
                            if (nameA < nameB) {
                                return -1;
                            }
                            if (nameA > nameB) {
                                return 1;
                            }
                            return 0;
                        });
                        // store tags in either already active tags, or tags available to refine the search by
                        $.each(tagArray, function(key, tag) {
                            var inArray = $.inArray(tag.original, activeTags)>=0;
                            if (!inArray) {
                                refineTags.push(tag);
                            }
                        });

                        if (showTagCloud) {
                            renderTagCloud();
                        }
                    } else if (!$.isEmptyObject(data)) {
                        if (showTagCloud) {
                            $(".tagcloud-row", $rootel).html("<div class='no-tags'>No tags to display</div>");
                            $(".tagcloud-container", $rootel).show();
                        }
                    }
                    renderTagFilter();
                });
        };

        ////////////////////
        // State handling //
        ////////////////////

        /**
         * Deal with changed state in the library. This can be triggered when
         * a search was initiated, sort was changed, etc.
         */
        var handleHashChange = function(e) {
            var ls = $.bbq.getState("ls") || "list";
            $(".s3d-page-header-top-row .s3d-listview-options", $rootel).find("div").removeClass("selected");
            if (ls === "list"){
                $("#mylibrary_items", $rootel).removeClass("s3d-search-results-grid");
                $mylibrary_show_list.addClass("selected");
                $mylibrary_show_list.children().addClass("selected");
                mylibrary.listStyle = "list";
            } else if (ls === "grid"){
                $("#mylibrary_items", $rootel).addClass("s3d-search-results-grid");
                $(".s3d-page-header-top-row .s3d-listview-options", $rootel).find("div").removeClass("selected");
                $mylibrary_show_grid.addClass("selected");
                $mylibrary_show_grid.children().addClass("selected");
                mylibrary.listStyle = "grid";
            }
            if ($.bbq.getState("refine")) {
            	activeTags = $.bbq.getState("refine").split(",");                
            } else {
                activeTags = [];
            }

            if (mylibrary.widgetShown){
                // Set the sort states
                var parameters = $.bbq.getState();
                mylibrary.sortOrder = parameters["lso"] || "modified";
                mylibrary.sortBy = parameters["lsb"] || "_lastModified";
                $mylibrary_livefilter.val(parameters["lq"] || "");
                $mylibrary_sortby.val(mylibrary.sortOrder);
                showLibraryContent();
            }
        };

        ////////////////////
        // Search library //
        ////////////////////

        /**
         * Search the current library. This function will extract the query
         * from the search box directly.
         */
        var doSearch = function(){
            var q = $.trim($mylibrary_livefilter.val());
            if (q) {
                $.bbq.pushState({"lq": q});
            } else {
                $.bbq.removeState("lq");
            }
        };

        var updateButtonData = function(){
            var idArr = [];
            var titleArr = [];
            $.each($(".mylibrary_check:checked:visible", $rootel), function(i, checked){
                idArr.push($(checked).attr("data-entityid"));
                titleArr.push($(checked).attr("data-entityname"));
            });
            $("#mylibrary_content_share", $rootel).attr("data-entityid", idArr);
            $("#mylibrary_addpeople_button", $rootel).attr("data-entityid", idArr);
            $("#mylibrary_addpeople_button", $rootel).attr("data-entityname", titleArr);
        };

        ////////////////////
        // Event Handlers //
        ////////////////////

        var addBinding = function(){
            /**
             * Enable/disable the remove selected button depending on whether
             * any items in the library are checked
             */
            $mylibrary_check.live("change", function (ev) {
                if ($(this).is(":checked")) {
                    $mylibrary_remove.removeAttr("disabled");
                    $mylibrary_addto.removeAttr("disabled");
                    $mylibrary_share.removeAttr("disabled");
                } else if (!$(".mylibrary_check:checked", $rootel).length) {
                    $mylibrary_remove.attr("disabled", "disabled");
                    $mylibrary_addto.attr("disabled", "disabled");
                    $mylibrary_share.attr("disabled", "disabled");
                }
                updateButtonData();
            });

            /**
             * Check/uncheck all loaded items in the library
             */
            $mylibrary_check_all.change(function (ev) {
                if ($(this).is(":checked")) {
                    $(".mylibrary_check").attr("checked", "checked");
                    $mylibrary_remove.removeAttr("disabled");
                    $mylibrary_addto.removeAttr("disabled");
                    $mylibrary_share.removeAttr("disabled");
                } else {
                    $(".mylibrary_check").removeAttr("checked");
                    $mylibrary_remove.attr("disabled", "disabled");
                    $mylibrary_addto.attr("disabled", "disabled");
                    $mylibrary_share.attr("disabled", "disabled");
                }
                updateButtonData();
            });

            /**
             * Gather all selected library items and initiate the
             * deletecontent widget
             */
            $mylibrary_remove.click(function (ev) {
                var $checked = $(".mylibrary_check:checked:visible", $rootel);
                if ($checked.length) {
                    var paths = [];
                    $checked.each(function () {
                        paths.push($(this).data("entityid"));
                    });
                    $(window).trigger('init.deletecontent.sakai', [{
                        paths: paths,
                        context: mylibrary.contextId
                    }, function (success) {
                        if (success) {
                            resetView();
                            $(window).trigger("lhnav.updateCount", ["library", -(paths.length)]);
                            mylibrary.infinityScroll.removeItems(paths);
                        }
                    }]);
                }
            });

            /**
             * Called when clicking the remove icon next to an individual content
             * item
             */
            $mylibrary_remove_icon.live("click", function(ev) {
                if ($(this).attr("data-entityid")){
                    var paths = [];
                    paths.push($(this).attr("data-entityid"));
                    $(window).trigger('init.deletecontent.sakai', [{
                        paths: paths,
                        context: mylibrary.contextId
                    }, function (success) {
                        if (success) {
                            resetView();
                            $(window).trigger("lhnav.updateCount", ["library", -(paths.length)]);
                            mylibrary.infinityScroll.removeItems(paths);
                        }
                    }]);
                }
            });

            /**
             * Reload the library list based on the newly selected
             * sort option
             */
            $mylibrary_sortby.change(function (ev) {
                var query = $.trim($mylibrary_livefilter.val());
                var sortSelection = $(this).val();
                if (sortSelection === "desc") {
                    mylibrary.sortOrder = "desc";
                    mylibrary.sortBy = "filename";
                } else if (sortSelection === "asc") {
                    mylibrary.sortOrder = "asc";
                    mylibrary.sortBy = "filename";
                } else {
                    mylibrary.sortOrder = "modified";
                    mylibrary.sortBy = "_lastModified";
                }
                $.bbq.pushState({"lsb": mylibrary.sortBy, "lso": mylibrary.sortOrder, "lq": query});
            });

            /**
             * Initiate a library search when the enter key is pressed
             */
            $mylibrary_livefilter.keyup(function (ev) {
                if (ev.keyCode === 13) {
                    doSearch();
                }
                return false;
            });

            /**
             * Initiate a search when the search button next to the search
             * field is pressed
             */
            $mylibrary_search_button.click(doSearch);

            /**
             * Initiate the add content widget
             */
            $mylibrary_addcontent.click(function (ev) {
                $(window).trigger("init.newaddcontent.sakai");
                return false;
            });

            /**
             * Listen for newly the newly added content or newly saved content
             * @param {Object} data        Object that contains the new library items
             * @param {Object} library     Context id of the library the content has been added to
             */
            $(window).bind("done.newaddcontent.sakai", function(e, data, library) {
                if (library === mylibrary.contextId || mylibrary.contextId === sakai.data.me.user.userid) {
                    mylibrary.infinityScroll.prependItems(data);
                }
            });

            /**
             * Keep track as to whether the current library widget is visible or not. If the
             * widget is not visible, it's not necessary to respond to hash change events.
             */
            $(window).bind(tuid + ".shown.sakai", function(e, shown){
                mylibrary.widgetShown = shown;
            });
            /**
             * Bind to hash changes in the URL
             */
            $(window).bind("hashchange", handleHashChange);

            $mylibrary_show_list.click(function(){
                $.bbq.pushState({"ls": "list"});
            });

            $mylibrary_show_grid.click(function(){
                $.bbq.pushState({"ls": "grid"});
            });
            /**
             * Bind tag filter actions
             */
            $rootel.on("click", ".tagcloud-row a, .s3d-search-tag button", function(event) {
                var tag;
                if ($(this).parents(".jqcloud.tagcloud-row:first").length) {
                    tag = $(this).parents(".search-tag:first").data("sakai-entityid")+"";
                } else {
                    tag = $(this).data("sakai-entityid")+"";
                }
                if ($.inArray(tag,activeTags) >= 0) {
                    activeTags = $.grep(activeTags, function(value) {return value != tag});
                } else {
                    activeTags.push(tag);
                }
                var newSearchState = {"refine": activeTags.join(",")};
                if ($.bbq.getState("pq") === undefined) {
                    newSearchState.pq = "";
                }
                $.bbq.pushState(newSearchState);
            });
            
            $(".tagcloud-container .s3d-search-results-cloudview", $rootel).on("click", function() {
                $(this).parents(".s3d-header-button:first").find("div").removeClass("selected");
                $(this).addClass("selected").parent().addClass("selected");
                renderTagCloud();
            });
            
            $(".tagcloud-container .s3d-search-results-listview", $rootel).on("click", function() {
                $(this).parents(".s3d-header-button:first").find("div").removeClass("selected");
                $(this).addClass("selected").parent().addClass("selected");
                renderTagCloud();                
            });
        };

        ////////////////////////////////////////////
        // Data retrieval and rendering functions //
        ////////////////////////////////////////////

        /**
         * Process library item results from the server
         */
        var handleLibraryItems = function (results, callback) {
            sakai.api.Content.prepareContentForRender(results, sakai.data.me, function(contentResults){
                if (contentResults.length > 0){
                    callback(contentResults);
                    showHideTopControls(true);
                    $mylibrary_empty.hide();
                    $mylibrary_items.show();
                } else {
                    callback([]);
                }
            });
        };

        var renderTagCloud = function() {
            if ($(".tagcloud-container .s3d-search-results-listview",$rootel).hasClass("selected")) {
                $(".tagcloud-row", $rootel).removeClass("jqcloud");
                // sort tagArray by name
                tagArray.sort(function(a, b){
                    var nameA = a.value.toLowerCase();
                    var nameB = b.value.toLowerCase();
                    if (nameA < nameB) {
                        return -1;
                    }
                    if (nameA > nameB) {
                        return 1;
                    }
                    return 0;
                });
                sakai.api.Util.TemplateRenderer("mylibrary_tagcloud_list_template", {"tags": tagArray, "activetags": activeTags}, $(".tagcloud-row", $rootel)); 
            } else {
                $(".tagcloud-row", $rootel).addClass("jqcloud");
                // sort tagArray by magnitude
                tagArray.sort(function(a, b){
                    var countA = a.count;
                    var countB = b.count;
                    if (countA > countB) {
                        return -1;
                    }
                    if (countA < countB) {
                        return 1;
                    }
                    return 0;
                });
                var tagDataForCloud = [];
                for (var i=0; i<tagArray.length;i++) {
                    if (i === MAX_TAGS_IN_CLOUD) {
                        break;
                    }
                    tagDataForCloud.push({
                        text: tagArray[i].original,
                        title: tagArray[i].original+ " has "+tagArray[i].count+" matches",
                        weight: tagArray[i].count,
                        url: "javascript:void(0);",
                        customClass: ($.inArray(tagArray[i].original, activeTags)>=0)?"search-tag active":"search-tag",
                        dataAttributes: {
                            "sakai-entityid": tagArray[i].original
                        }
                    });
                }
                $(".tagcloud-row", $rootel).empty();
                $(".tagcloud-row", $rootel).jQCloud(tagDataForCloud, {
                    height: 180,
                    width: 730
                });
                if (tagArray.length > MAX_TAGS_IN_CLOUD) {
                    $(".tagcloud-row", $rootel).append($("#mylibrary_notalltagsdisplayed_message").html());
                }
            }            
            
            $(".tagcloud-container", $rootel).show();
        };

        function renderTagFilter() {
            // render tag filters                    
            sakai.api.Util.TemplateRenderer("search_tags_active_template", {"tags": sakai.api.Util.formatTags(activeTags), "sakai": sakai}, $("#search_tags_active_container", $rootel));
            // only show refine filter if there's no tag cloud
            if (!showTagCloud) {
                var sortedRefineTags = refineTags.sort(function(a, b){
                    var countA = a.count;
                    var countB = b.count;
                    if (countA > countB) {
                        return -1;
                    }
                    if (countA < countB) {
                        return 1;
                    }
                    return 0;
                });
                sortedRefineTags = sortedRefineTags.slice(0, MAX_TAGS_IN_FILTER);
                sortedRefineTags = sortedRefineTags.sort(function(a, b){
                    var nameA = a.value.toLowerCase();
                    var nameB = b.value.toLowerCase();
                    if (nameA < nameB) {
                        return -1;
                    }
                    if (nameA > nameB) {
                        return 1;
                    }
                    return 0;
                });
                sakai.api.Util.TemplateRenderer("search_tags_refine_template", {"tags": sortedRefineTags, "sakai": sakai}, $(".search_tags_refine_container", $rootel));
            }
        }

        /////////////////////////////
        // Initialization function //
        /////////////////////////////

        /**
         * Initialization function that is run when the widget is loaded. Determines
         * which mode the widget is in (settings or main), loads the necessary data
         * and shows the correct view.
         */
        var doInit = function () {
            mylibrary.contextId = "";
            var contextName = "";
            var isGroup = false;

            // We embed the deletecontent widget, so make sure it's loaded
            sakai.api.Widgets.widgetLoader.insertWidgets(tuid, false);

            if (widgetData && widgetData.nyumylibrary) {
                mylibrary.contextId = widgetData.nyumylibrary.groupid;
                sakai.api.Server.loadJSON("/system/userManager/group/" +  mylibrary.contextId + ".json", function(success, data) {
                    if (success){
                        currentGroup = data;
                        contextName = currentGroup.properties["sakai:group-title"];
                        isGroup = true;
                        mylibrary.isOwnerViewing = sakai.api.Groups.isCurrentUserAManager(currentGroup.properties["sakai:group-id"], sakai.data.me, currentGroup.properties);
                        finishInit(contextName, isGroup);
                    }
                });
            } else {
                mylibrary.contextId = sakai_global.profile.main.data.userid;
                contextName = sakai.api.User.getFirstName(sakai_global.profile.main.data);
                if (mylibrary.contextId === sakai.data.me.user.userid) {
                    mylibrary.isOwnerViewing = true;
                }
                finishInit(contextName, isGroup);
            }
        };

        /**
         * Additional set-up of the widget
         */
        var finishInit = function(contextName, isGroup){
            if (mylibrary.contextId) {
                mylibrary.default_search_text = getPersonalizedText("SEARCH_YOUR_LIBRARY");
                mylibrary.currentPagenum = 1;
                var all = state && state.all ? state.all : {};
                mylibrary.listStyle = $.bbq.getState("ls") || "list";
                if (showTagCloud) {
                    require(["/devwidgets/nyumylibrary/lib/jquery.jqcloud.js"], function() {
                        $(".participants_widget", $rootel).addClass("tagcloud-enabled");
                        handleHashChange(null, true);
                    });
                } else {
                    handleHashChange(null, true);
                }
                sakai.api.Util.TemplateRenderer("mylibrary_title_template", {
                    isMe: mylibrary.isOwnerViewing,
                    isGroup: isGroup,
                    user: contextName
                }, $("#mylibrary_title_container", $rootel));
            } else {
                debug.warn("No user found for My Library");
            }
            addBinding();
        };

        // run the initialization function when the widget object loads
        doInit();

    };

    // inform Sakai OAE that this widget has loaded and is ready to run
    sakai.api.Widgets.widgetLoader.informOnLoad("nyumylibrary");
});
