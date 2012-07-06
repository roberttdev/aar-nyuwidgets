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
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

// load the master sakai object to access all Sakai OAE API methods
require(["jquery", "sakai/sakai.api.core"], function($, sakai) {

    /**
     * @name sakai_global.participants
     *
     * @class participants
     *
     * @version 0.0.1
     * @param {String} tuid Unique id of the widget
     * @param {Boolean} showSettings Show the settings of the widget or not
     */
    sakai_global.nyuparticipants = function (tuid, showSettings, widgetData) {

        var rootel = $("#" + tuid);

        /////////////////////////////
        // Configuration variables //
        /////////////////////////////
        var infinityScroll = false;

        var showExtraInfo = false;
        var showTagCloud = false;
        if (widgetData.hasOwnProperty("nyuparticipants")) { // if new widget (>= v1.1)
            showExtraInfo = widgetData.nyuparticipants.showExtraInfo;
            showTagCloud = widgetData.nyuparticipants.showTagCloud;
        } else if (widgetData.hasOwnProperty("participants")) { // legacy < v1.1 widgets
            showExtraInfo = widgetData.participants.showExtraInfo;
            showTagCloud = widgetData.participants.showTagCloud;
        }
        var tagArray = [];
        var activeTags = [];
	var refineTags = [];	
        var MAX_TAGS_IN_CLOUD = 20;
        var MAX_TAGS_IN_FILTER = 10;
        
        // Containers
        var $participantsListContainer = $("#participants_list_container_list", rootel);

        // Templates
        var participantsListTemplate = "participants_list_template";
        var participantsListTemplateEmpty = "participants_list_empty_template";

        // Elements
        var $participantsSearchField = $("#participants_search_field", rootel);
        var participantsListParticipantRequestConnection = ".participants_list_participant_request_connection";
        var $participantsSelectAll = $("#participants_select_all", rootel);
        var participantsListParticipantCheckbox = ".participants_list_participant_checkbox input:checkbox";
        var $participantsSendSelectedMessage = $("#participants_send_selected_message", rootel);
        var $participantsAddPeopleButton = $("#participants_addpeople_button", rootel);
        var participantsListParticipantName = ".participants_list_participant_name";
        var $participants_sort_by = $("#participants_sort_by", rootel);
        var participantsShowGrid = $(".s3d-page-header-top-row .s3d-listview-grid", rootel);
        var participantsShowList = $(".s3d-page-header-top-row .s3d-listview-list", rootel);
        widgetData.listStyle = "list";
        widgetData.query = "";
        widgetData.sortby = "asc";

        var newlyAdded = [],
            roles = false;

        ///////////////////////
        // Utility functions //
        ///////////////////////

        var enableDisableButtons = function(){
            if($(participantsListParticipantCheckbox + ":checked", rootel).length){
                $participantsSendSelectedMessage.removeAttr("disabled");
                $participantsAddPeopleButton.removeAttr("disabled");
            } else {
                $participantsSendSelectedMessage.attr("disabled", "disabled");
                $participantsSelectAll.removeAttr("checked");
                $participantsAddPeopleButton.attr("disabled", "disabled");
            }
        };

        /**
         * Set the attributes needed by the sendmessage widget to send a message to all selected users
         */
        var setSendSelectedMessageAttributes = function(){
            var userArr = [];
            var userIDArr = [];
            $.each($(participantsListParticipantCheckbox + ":checked", rootel), function(index, item){
                userIDArr.push($(item).attr("data-entityid"));
                userArr.push($(item).attr("data-entityname"));
            });
            $participantsSendSelectedMessage.attr("sakai-entitytype", "user");
            $participantsSendSelectedMessage.attr("sakai-entityname", userArr);
            $participantsSendSelectedMessage.attr("sakai-entityid", userIDArr);
            $participantsAddPeopleButton.attr("data-entityname", userArr);
            $participantsAddPeopleButton.attr("data-entityid", userIDArr);
            enableDisableButtons();
        };

        /**
         * Check/Uncheck all items in the members list and enable/disable buttons
         */
        var checkAll = function(){
            if($(this).is(":checked")){
                $(participantsListParticipantCheckbox, rootel).attr("checked","checked");
                setSendSelectedMessageAttributes();
            }else{
                $(participantsListParticipantCheckbox, rootel).removeAttr("checked");
                enableDisableButtons();
            }
        };


        var getRoleTitle = function(result) {
            var ret = "";
            if (result.role && result.role.title) {
                ret = result.role.title;
            } else if (result.role === undefined && newlyAdded && newlyAdded.length && roles && roles.length) {
                $.each(newlyAdded, function(i, member) {
                    if (member.user === result["rep:userId"] || member.user === result["sakai:group-id"]) {
                        $.each(roles, function(i, role) {
                            if (role.id === member.permission) {
                                ret = role.title;
                            }
                        });
                    }
                });
            }
            return ret;
        };

        //////////////////////
        // Render functions //
        //////////////////////

        var processParticipants = function (results, callback){
            var extraFields = sakai.widgets.nyuparticipants.defaultConfiguration.extraFields;
            var participantsArr = [];
            if (results && results.length){
                sakai.api.User.getContacts(function() {
                    $.each(results, function(i, result){
                        var contentCount = 0;
                        var contactsCount = 0;
                        var membershipsCount = 0;
                        if (result.counts){
                            contentCount = result.counts.contentCount;
                            contactsCount = result.counts.contactsCount;
                            membershipsCount = result.counts.membershipsCount;
                        }
                        var picture = false;
                        var roleTitle = getRoleTitle(result);
                        if (result["sakai:group-id"]) {
                            if(result.basic.elements.picture && result.basic.elements.picture.value){
                                picture = sakai.api.Groups.getProfilePicture(result);
                            }
                            participantsArr.push({
                                "name": result["sakai:group-title"],
                                "id": result["sakai:group-id"],
                                "title": roleTitle,
                                "type": "group",
                                "connected": false,
                                "content": contentCount,
                                "contacts": contactsCount,
                                "memberships": membershipsCount,
                                "profilePicture": picture,
                                "membersCount": result.counts.membersCount
                            });
                        } else {
                            // Check if this user is a friend of us already.
                            var connected = false, invited = false, pending = false, none = false;
                            if (sakai.data.me.mycontacts) {
                                $.each(sakai.data.me.mycontacts, function(ii, contact){
                                    if (contact.target === result["rep:userId"]) {
                                        connected = true;
                                        // if invited state set invited to true
                                        if(contact.details["sakai:state"] === "INVITED"){
                                            invited = true;
                                        } else if(contact.details["sakai:state"] === "PENDING"){
                                            pending = true;
                                        } else if(contact.details["sakai:state"] === "NONE"){
                                            none = true;
                                        }
                                    }
                                });
                            }
                            if(result.basic.elements.picture && result.basic.elements.picture.value){
                                picture = sakai.api.User.getProfilePicture(result);
                            }

                            var userToPush = {
                                "name": sakai.api.User.getDisplayName(result),
                                "id": result["rep:userId"],
                                "title": roleTitle,
                                "type": "user",
                                "content": contentCount,
                                "contacts": contactsCount,
                                "memberships": membershipsCount,
                                "connected": connected,
                                "invited": invited,
                                "pending": pending,
                                "none": none,
                                "profilePicture": picture
                            };
                            // Get the extra info and push it on to the users
                            if (showExtraInfo) {
                                var userExtraFields = [];
                                $.each(extraFields, function(idx,field) {
                                    var val = sakai.api.User.getProfileBasicElementValue(result, field.key);
                                    var searchVal = val;
                                    // The select element type is special, and requires that we get the i18n key
                                    // from the basic profile config, since it only stores the key and not
                                    // the value in the basic profile
                                    if (sakai.config.Profile.configuration.defaultConfig.basic.elements[field.key] &&
                                        sakai.config.Profile.configuration.defaultConfig.basic.elements[field.key].type === "select") {

                                        val = sakai.config.Profile.configuration.defaultConfig.basic.elements[field.key].select_elements[val];
                                        val = sakai.api.i18n.General.process(val);
                                    }
                                    if (val) {
                                        userExtraFields.push({
                                            "title": sakai.api.i18n.getValueForKey(field.title),
                                            "value": field.key === "sakai:tags" ? val = sakai.api.Util.formatTags(val) : sakai.api.Util.applyThreeDots(val, 650, {max_rows: 2, whole_word: false}, "participants_list_extra_field"),
                                            "isTag": field.key === "sakai:tags",
                                            "searchable": field.searchable,
                                            "searchField": searchVal
                                        });
                                    }
                                });
                                if (userExtraFields.length) {
                                    userToPush.extraFields = userExtraFields;
                                }
                            }
                            participantsArr.push(userToPush);
                        }
                    });
                });
            }
            callback(participantsArr);
        };

        ////////////////////
        // Init functions //
        ////////////////////

        var loadParticipants = function(){
            // Disable the previous infinite scroll
            if (infinityScroll){
                infinityScroll.kill();
            }
            // Set up the infinite scroll for the list of items in the library
            infinityScroll = $participantsListContainer.infinitescroll(
                function(parameters, callback){
                    $participantsSearchField.addClass("searching");
                    sakai.api.Groups.searchMembers(sakai_global.group.groupId, widgetData.query, parameters.items, parameters.page, parameters.sortBy, parameters.sortOrder, function(success, data){
                        $participantsSearchField.removeClass("searching");
                        callback(true, data);
                    });
                },
                {
                    "query": widgetData.query,
                    "sortBy": "lastName",
                    "sortOrder": widgetData.sortby
                },
                function(items, total){
                    if (sakai.data.me.user.anon){
                        $(".s3d-page-header-top-row", rootel).show();
                    } else {
                        $(".s3d-page-header-top-row", rootel).show();
                        $(".s3d-page-header-bottom-row", rootel).show();
                    }
                    $participantsSelectAll.removeAttr("checked");
                    setSendSelectedMessageAttributes();

                    return sakai.api.Util.TemplateRenderer(participantsListTemplate, {
                        "participants": items,
                        "sakai": sakai
                    });
                },
                function(){
                    $participantsListContainer.html(sakai.api.Util.TemplateRenderer(participantsListTemplateEmpty, {}));
                },
                sakai.config.URL.INFINITE_LOADING_ICON,
                function(data, callback) {
                    processParticipants(data, callback);
                },
                $.noop,
                $.noop,
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
                            $(".tagcloud-row").html("<div class='no-tags'>No tags to display</div>");
                            $(".tagcloud-container", rootel).show();
                        }
                    }
                    renderTagFilter();
                });
        };

        var renderTagCloud = function() {
            if ($(".tagcloud-container .s3d-search-results-listview",rootel).hasClass("selected")) {
                $(".tagcloud-row", rootel).removeClass("jqcloud");
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
                sakai.api.Util.TemplateRenderer($("#nyuparticipants_tagcloud_list", rootel), {"tags": tagArray, "activetags": activeTags}, $(".tagcloud-row", rootel)); 
            } else {
                $(".tagcloud-row", rootel).addClass("jqcloud");
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
                $(".tagcloud-row", rootel).empty();
                $(".tagcloud-row", rootel).jQCloud(tagDataForCloud, {
                    height: 180,
                    width: 730
                });
                if (tagArray.length > MAX_TAGS_IN_CLOUD) {
                    $(".tagcloud-row").append($("#nyuparticipants_notalltagsdisplayed_message").html());
                }
            }            
            
            $(".tagcloud-container", rootel).show();
        };

        function renderTagFilter() {
            // render tag filters                    
            sakai.api.Util.TemplateRenderer($("#search_tags_active_template"), {"tags": sakai.api.Util.formatTags(activeTags), "sakai": sakai}, $("#search_tags_active_container", rootel));            
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
                sakai.api.Util.TemplateRenderer($("#search_tags_refine_template"), {"tags": sortedRefineTags, "sakai": sakai}, $(".search_tags_refine_container", rootel)); 
            }
        }

        var handleHashChange = function(){
            $(".s3d-page-header-top-row .s3d-listview-options", rootel).find("div").removeClass("selected");
            var ls = $.bbq.getState("ls") || widgetData.listStyle;
            if (ls === "list"){
                $("#participants_list_container_list", rootel).removeClass("s3d-search-results-grid");
                $(participantsShowList, rootel).addClass("selected");
                $(participantsShowList, rootel).children().addClass("selected");
            } else if (ls === "grid"){
                $(participantsShowGrid, rootel).addClass("selected");
                $(participantsShowGrid, rootel).children().addClass("selected");
                $("#participants_list_container_list", rootel).addClass("s3d-search-results-grid");
            }
            widgetData.query = $.bbq.getState("pq") || "";
            $participantsSearchField.val(widgetData.query);

            if ($.bbq.getState("refine")) {
            	activeTags = $.bbq.getState("refine").split(",");
                if (widgetData.query.length > 0) {
                	widgetData.query += " AND ";
                }
                widgetData.query += activeTags.join(" AND ");
            } else {
                activeTags = [];
            }
            
            widgetData.sortby = $.bbq.getState("psb") || "asc";
            $participants_sort_by.val(widgetData.sortby);
            loadParticipants();
        };

        var addBinding = function(){
            $(window).bind("hashchanged.participants.sakai", handleHashChange);

            $(".participants_widget .s3d-search-button").unbind("click").bind("click", function(){
                currentPage = 1;
                $.bbq.pushState({"pq": $.trim($participantsSearchField.val())});
            });
            $participantsSearchField.unbind("keyup").bind("keyup", function(ev) {
                if (ev.keyCode === 13) {
                    $.bbq.pushState({"pq": $.trim($participantsSearchField.val())});
                }
            });
            $participants_sort_by.unbind("change").bind("change", function(){
                $.bbq.pushState({"psb": $participants_sort_by.val()});
            });
            $participantsSelectAll.unbind("click").bind("click", checkAll);
            $(participantsListParticipantCheckbox, rootel).live("click", setSendSelectedMessageAttributes);

            $(".participants_accept_invitation").live("click", function(ev){
                var userid = $(this).attr("sakai-entityid");
                sakai.api.User.acceptContactInvite(userid, function(){
                    $('.participants_accept_invitation').each(function(index) {
                        if ($(this).attr("sakai-entityid") === userid){
                            $(this).hide();
                        }
                    });
                });
            });

            $(window).bind("sakai.addToContacts.requested", function(ev, userToAdd){
                $('.sakai_addtocontacts_overlay').each(function(index) {
                    if ($(this).attr("sakai-entityid") === userToAdd.uuid){
                        $(this).hide();
                    }
                });
            });

            $(participantsShowList, rootel).click(function(){
                $.bbq.pushState({"ls": "list"});
            });

            $(participantsShowGrid, rootel).click(function(){
                $.bbq.pushState({"ls": "grid"});
            });

            $(rootel).on("click", ".tagcloud-row a, .s3d-search-tag button", function(event) {
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
            
            $(".tagcloud-container .s3d-search-results-cloudview").on("click", function() {
                $(this).parents(".s3d-header-button:first").find("div").removeClass("selected");
                $(this).addClass("selected").parent().addClass("selected");
                renderTagCloud();
            });
            
            $(".tagcloud-container .s3d-search-results-listview").on("click", function() {
                $(this).parents(".s3d-header-button:first").find("div").removeClass("selected");
                $(this).addClass("selected").parent().addClass("selected");
                renderTagCloud();                
            });
        };

        var init = function(){
            var groupData = $.extend(true, {}, sakai_global.group.groupData);
            groupData.roles = groupData["sakai:roles"];
            roles = sakai.api.Groups.getRoles(groupData);
            if (sakai.api.Groups.isCurrentUserAManager(sakai_global.group.groupId, sakai.data.me, groupData)){
                $("#participants_manage_participants").show();
            }

            addBinding();

            if (showTagCloud) {
		require(["/devwidgets/nyuparticipants/lib/jquery.jqcloud.js"], function() {
                    $(".participants_widget",rootel).addClass("tagcloud-enabled");
                    handleHashChange();
                });
            } else {
            	handleHashChange();
            }      
        };

        $(window).bind("usersselected.addpeople.sakai", function(e, _newlyAdded){
            newlyAdded = _newlyAdded;
            setTimeout(loadParticipants, 1000);
        });

	$(window).triggerHandler("sakai.search.util.init");

        init();

    };

    // inform Sakai OAE that this widget has loaded and is ready to run
    sakai.api.Widgets.widgetLoader.informOnLoad("nyuparticipants");
});