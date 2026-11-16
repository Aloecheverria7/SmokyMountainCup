
        setREVStartSize({
            c: 'rev_slider_1_1',
            rl: [1240, 1240, 1240, 480],
            el: [1100, 1100, 1100, 500],
            gw: [1240, 1240, 1240, 480],
            gh: [1100, 1100, 1100, 500],
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
                    jsFileLocation: "//demo.goodlayers.com/bigslam/homepages/soccer01/wp-content/plugins/revslider/public/assets/js/",
                    sliderLayout: "fullwidth",
                    visibilityLevels: "1240,1240,1240,480",
                    gridwidth: "1240,1240,1240,480",
                    gridheight: "1100,1100,1100,500",
                    minHeight: "",
                    editorheight: "1100,768,960,500",
                    responsiveLevels: "1240,1240,1240,480",
                    disableProgressBar: "on",
                    navigation: {
                        mouseScrollNavigation: false,
                        onHoverStop: false,
                        touch: {
                            touchenabled: true
                        },
                        arrows: {
                            enable: true,
                            style: "uranus",
                            hide_onleave: true,
                            left: {

                            },
                            right: {

                            }
                        }
                    },
                    fallbacks: {
                        allowHTML5AutoPlayOnAndroid: true
                    },
                });
            }

        });
    