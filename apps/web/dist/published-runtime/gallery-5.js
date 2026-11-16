
        setREVStartSize({
            c: 'rev_slider_1_1',
            rl: [1240, 1240, 1240, 480],
            el: [890, 890, 890, 520],
            gw: [1300, 1300, 1300, 480],
            gh: [890, 890, 890, 520],
            layout: 'fullwidth',
            mh: "0"
        });
        var revapi1,
            tpj;
        jQuery(function () {
            tpj = jQuery;
            if (tpj("#rev_slider_1_1").revolution == undefined) {
                revslider_showDoubleJqueryError("#rev_slider_1_1");
            } else {
                revapi1 = tpj("#rev_slider_1_1").show().revolution({
                    jsFileLocation: "plugins/revslider/public/assets/js/",
                    visibilityLevels: "1240,1240,1240,480",
                    gridwidth: "1300,1300,1300,480",
                    gridheight: "890,890,890,520",
                    minHeight: "",
                    editorheight: "890,768,960,520",
                    responsiveLevels: "1240,1240,1240,480",
                    disableProgressBar: "on",
                    navigation: {
                        mouseScrollNavigation: false,
                        onHoverStop: false,
                        arrows: {
                            enable: true,
                            style: "uranus",
                            hide_onmobile: true,
                            hide_under: "980px",
                            hide_onleave: true,
                            left: {
                                v_offset: 101
                            },
                            right: {
                                v_offset: 101
                            }
                        },
                        bullets: {
                            enable: true,
                            tmp: "<span class=/"tp- bullet - inner / "></span>",
                        style: "uranus",
                        v_offset: 40,
                        space: 10
                    }
                },
                    fallbacks: {
                    allowHTML5AutoPlayOnAndroid: true
                },
                });
            }

        });
    