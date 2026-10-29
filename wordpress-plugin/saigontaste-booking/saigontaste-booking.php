<?php
/**
 * Plugin Name:       Saigon Taste Booking
 * Description:       Booking form connected to the Saigon Taste Booking app. Add the shortcode [saigontaste_booking] to your booking page.
 * Version:           1.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Saigon Taste
 * License:           Proprietary
 * Text Domain:       saigontaste-booking
 */

if (!defined('ABSPATH')) {
    exit;
}

define('STB_VERSION', '1.0.0');
define('STB_OPT', 'stb_settings');
define('STB_NS', 'saigontaste-booking/v1');

/** Settings with defaults. */
function stb_settings() {
    $s = get_option(STB_OPT, array());
    return wp_parse_args(is_array($s) ? $s : array(), array(
        'app_url'     => '',
        'api_key'     => '',
        'accent'      => '',
        'privacy_url' => '',
    ));
}

/* ------------------------------------------------------------------
 * Shortcode: [saigontaste_booking accent="#24305a" title="Book a table"]
 * ------------------------------------------------------------------ */
add_shortcode('saigontaste_booking', 'stb_shortcode');
function stb_shortcode($atts) {
    $s = stb_settings();
    $a = shortcode_atts(array('accent' => $s['accent'], 'title' => ''), $atts, 'saigontaste_booking');
    wp_enqueue_style('stb-widget', plugins_url('assets/booking-widget.css', __FILE__), array(), STB_VERSION);
    wp_enqueue_script('stb-widget', plugins_url('assets/booking-widget.js', __FILE__), array(), STB_VERSION, true);

    $privacy = $s['privacy_url'] ? $s['privacy_url'] : (function_exists('get_privacy_policy_url') ? get_privacy_policy_url() : '');
    $accent  = preg_match('/^#[0-9a-fA-F]{3,8}$/', (string) $a['accent']) ? $a['accent'] : '';

    if (!$s['app_url'] || !$s['api_key']) {
        if (current_user_can('manage_options')) {
            return '<p style="padding:12px;border:1px dashed #c00;color:#c00">Saigon Taste Booking: open Settings → Saigon Taste Booking and enter the app address and connection key.</p>';
        }
        return '';
    }
    return sprintf(
        '<div class="stb" data-endpoint="%s" data-accent="%s" data-privacy="%s" data-title="%s"><noscript>Please enable JavaScript to book online, or call the restaurant.</noscript></div>',
        esc_attr(rest_url(STB_NS)),
        esc_attr($accent),
        esc_attr($privacy),
        esc_attr($a['title'])
    );
}

/* ------------------------------------------------------------------
 * REST proxy: the browser talks to this WordPress site, WordPress talks
 * to the app with the secret key. The key never reaches the browser.
 * ------------------------------------------------------------------ */
add_action('rest_api_init', function () {
    foreach (array('info', 'availability', 'book') as $action) {
        register_rest_route(STB_NS, '/' . $action, array(
            'methods'             => 'POST',
            'callback'            => function (WP_REST_Request $req) use ($action) {
                return stb_forward($action, $req);
            },
            'permission_callback' => '__return_true', // public booking form; the app checks every request
        ));
    }
});

/** The visitor's IP, passed to the app for rate limiting. Only REMOTE_ADDR: forwarding headers can be faked by the visitor. */
function stb_client_ip() {
    $ip = isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '';
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '';
}

function stb_call_app($action, $body) {
    $s = stb_settings();
    if (!$s['app_url'] || !$s['api_key']) {
        return new WP_Error('stb_not_configured', 'Not configured');
    }
    $url = rtrim($s['app_url'], '/') . '/api/public/v1/' . $action;
    return wp_remote_post($url, array(
        'timeout'     => 15,
        'redirection' => 0,
        'headers'     => array(
            'Content-Type'  => 'application/json',
            'Accept'        => 'application/json',
            'Authorization' => 'Bearer ' . $s['api_key'],
            'X-Client-IP'   => stb_client_ip(),
            'User-Agent'    => 'SaigonTasteBooking-WP/' . STB_VERSION . '; ' . home_url(),
        ),
        'body'        => wp_json_encode($body ? $body : new stdClass()),
    ));
}

function stb_forward($action, WP_REST_Request $req) {
    nocache_headers();
    $raw = $req->get_body();
    if (strlen($raw) > 20000) {
        return new WP_REST_Response(array('error' => 'too_large'), 413);
    }
    $body = json_decode($raw ? $raw : '{}', true);
    if (!is_array($body)) {
        $body = array();
    }
    $res = stb_call_app($action, $body);
    if (is_wp_error($res)) {
        $code = $res->get_error_code() === 'stb_not_configured' ? 503 : 502;
        return new WP_REST_Response(array('error' => 'unavailable', 'message' => 'The booking system cannot be reached right now. Please call the restaurant.'), $code);
    }
    $status = (int) wp_remote_retrieve_response_code($res);
    $data   = json_decode(wp_remote_retrieve_body($res), true);
    if (!is_array($data)) {
        $data = array('error' => 'bad_response');
        $status = 502;
    }
    $out = new WP_REST_Response($data, $status ? $status : 502);
    $out->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    return $out;
}

/* ------------------------------------------------------------------
 * Settings page: Settings → Saigon Taste Booking
 * ------------------------------------------------------------------ */
add_action('admin_menu', function () {
    add_options_page('Saigon Taste Booking', 'Saigon Taste Booking', 'manage_options', 'saigontaste-booking', 'stb_settings_page');
});

add_action('admin_init', function () {
    register_setting('stb', STB_OPT, array('sanitize_callback' => 'stb_sanitize'));
});

function stb_sanitize($in) {
    $old = stb_settings();
    $in  = is_array($in) ? $in : array();
    $url = isset($in['app_url']) ? esc_url_raw(trim($in['app_url'])) : '';
    $key = isset($in['api_key']) ? trim(sanitize_text_field($in['api_key'])) : '';
    $acc = isset($in['accent']) ? sanitize_hex_color(trim($in['accent'])) : '';
    $pri = isset($in['privacy_url']) ? esc_url_raw(trim($in['privacy_url'])) : '';
    return array(
        'app_url'     => untrailingslashit($url),
        'api_key'     => $key !== '' ? $key : $old['api_key'], // blank field keeps the saved key
        'accent'      => $acc ? $acc : '',
        'privacy_url' => $pri,
    );
}

function stb_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }
    $s = stb_settings();
    $test = null;
    if (isset($_POST['stb_test']) && check_admin_referer('stb_test')) {
        $res = stb_call_app('info', array());
        if (is_wp_error($res)) {
            $test = array(false, 'Could not reach the app: ' . $res->get_error_message());
        } else {
            $code = (int) wp_remote_retrieve_response_code($res);
            $data = json_decode(wp_remote_retrieve_body($res), true);
            if ($code === 200 && is_array($data) && !empty($data['name'])) {
                $test = array(true, 'Connected to ' . $data['name'] . ($data['online'] ? '' : ' (online bookings are paused in the app)') . '.');
            } elseif ($code === 401) {
                $test = array(false, 'The app rejected the connection key. Copy a new key from the app (Restaurants → Website connection → New key).');
            } else {
                $test = array(false, 'Unexpected answer from the app (HTTP ' . $code . '). Check the app address.');
            }
        }
    }
    ?>
    <div class="wrap">
        <h1>Saigon Taste Booking</h1>
        <?php if ($test) : ?>
            <div class="notice notice-<?php echo $test[0] ? 'success' : 'error'; ?>"><p><?php echo esc_html($test[1]); ?></p></div>
        <?php endif; ?>
        <form method="post" action="options.php">
            <?php settings_fields('stb'); ?>
            <table class="form-table" role="presentation">
                <tr><th scope="row"><label for="stb_app_url">App address</label></th>
                    <td><input name="<?php echo STB_OPT; ?>[app_url]" id="stb_app_url" type="url" class="regular-text" value="<?php echo esc_attr($s['app_url']); ?>" placeholder="https://booking.saigontaste.com.au">
                    <p class="description">The address of the Saigon Taste Booking app.</p></td></tr>
                <tr><th scope="row"><label for="stb_api_key">Connection key</label></th>
                    <td><input name="<?php echo STB_OPT; ?>[api_key]" id="stb_api_key" type="password" class="regular-text" value="" autocomplete="off" placeholder="<?php echo $s['api_key'] ? esc_attr(substr($s['api_key'], 0, 10) . '••••••••') : 'st_…'; ?>">
                    <p class="description">From the app: Restaurants → Website connection. Leave blank to keep the saved key.</p></td></tr>
                <tr><th scope="row"><label for="stb_accent">Button colour</label></th>
                    <td><input name="<?php echo STB_OPT; ?>[accent]" id="stb_accent" type="text" class="small-text" value="<?php echo esc_attr($s['accent']); ?>" placeholder="#24305a">
                    <p class="description">Optional. Hex colour to match the website.</p></td></tr>
                <tr><th scope="row"><label for="stb_privacy">Privacy policy link</label></th>
                    <td><input name="<?php echo STB_OPT; ?>[privacy_url]" id="stb_privacy" type="url" class="regular-text" value="<?php echo esc_attr($s['privacy_url']); ?>" placeholder="<?php echo esc_attr(function_exists('get_privacy_policy_url') ? get_privacy_policy_url() : ''); ?>">
                    <p class="description">Optional. Blank uses the WordPress privacy page.</p></td></tr>
            </table>
            <?php submit_button(); ?>
        </form>
        <form method="post">
            <?php wp_nonce_field('stb_test'); ?>
            <p><button type="submit" name="stb_test" value="1" class="button">Test connection</button></p>
        </form>
        <h2>How to show the form</h2>
        <p>Add this shortcode to the booking page (block editor: add a “Shortcode” block):</p>
        <p><code>[saigontaste_booking]</code></p>
        <p>If your site uses SiteGround Optimizer, the form still works with page caching on: availability is always fetched live.</p>
    </div>
    <?php
}

add_filter('plugin_action_links_' . plugin_basename(__FILE__), function ($links) {
    array_unshift($links, '<a href="' . esc_url(admin_url('options-general.php?page=saigontaste-booking')) . '">Settings</a>');
    return $links;
});
